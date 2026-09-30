package de.steppicrew.beercounter.tips;

import android.util.Log;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tips through Play Billing: three consumable one-time products that unlock
 * nothing. Created in Play by scripts/play-products.mjs.
 *
 * Billing talks to the Play Store app over IPC, not to the network, so the app
 * still needs no INTERNET permission. Nothing is stored here: a tip is consumed
 * as soon as Play reports it paid, which both acknowledges it (Play refunds an
 * unacknowledged purchase after three days) and lets the same tip be bought
 * again.
 */
@CapacitorPlugin(name = "Tips")
public class TipsPlugin extends Plugin {

    private static final String TAG = "Tips";

    /** Must match TIP_PRODUCTS in src/lib/tips.ts. */
    private static final List<String> PRODUCT_IDS = Arrays.asList("tip_small", "tip_large", "tip_round");

    private BillingClient client;
    private final Map<String, ProductDetails> details = new ConcurrentHashMap<>();

    /** The buy() waiting for Play's answer; only one purchase flow runs at a time. */
    private PluginCall pendingBuy;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext().getApplicationContext())
            .setListener(this::onPurchasesUpdated)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    @PluginMethod
    public void products(PluginCall call) {
        withClient(() -> queryProducts(call), () -> resolveProducts(call));
    }

    @PluginMethod
    public void buy(PluginCall call) {
        String id = call.getString("id");
        ProductDetails product = id == null ? null : details.get(id);
        if (product == null) {
            call.reject("Unknown or unloaded product: " + id);
            return;
        }
        synchronized (this) {
            if (pendingBuy != null) {
                call.reject("A purchase is already in progress");
                return;
            }
            pendingBuy = call;
        }

        BillingFlowParams.ProductDetailsParams.Builder item =
            BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product);
        // Only needed to pick between offers; a legacy-compatible product's
        // plain purchase option may come without one.
        ProductDetails.OneTimePurchaseOfferDetails offer = product.getOneTimePurchaseOfferDetails();
        if (offer != null && offer.getOfferToken() != null) item.setOfferToken(offer.getOfferToken());

        BillingFlowParams params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(List.of(item.build()))
            .build();

        getActivity().runOnUiThread(() -> {
            BillingResult result = client.launchBillingFlow(getActivity(), params);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                finishBuy(statusFor(result.getResponseCode()));
            }
        });
    }

    private void withClient(Runnable ready, Runnable unavailable) {
        if (client.isReady()) {
            ready.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    consumeLeftovers();
                    ready.run();
                } else {
                    // Sideloaded, no Play Store, or an unsupported account.
                    Log.i(TAG, "Billing unavailable: " + result.getResponseCode());
                    unavailable.run();
                }
            }

            // Reconnection is automatic; the next call reconnects on its own.
            @Override
            public void onBillingServiceDisconnected() {}
        });
    }

    private void queryProducts(PluginCall call) {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (String id : PRODUCT_IDS) {
            list.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id)
                .setProductType(BillingClient.ProductType.INAPP)
                .build());
        }
        client.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(list).build(),
            (result, response) -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (ProductDetails product : response.getProductDetailsList()) {
                        details.put(product.getProductId(), product);
                    }
                }
                resolveProducts(call);
            });
    }

    private void resolveProducts(PluginCall call) {
        JSArray products = new JSArray();
        for (String id : PRODUCT_IDS) {
            ProductDetails product = details.get(id);
            ProductDetails.OneTimePurchaseOfferDetails offer =
                product == null ? null : product.getOneTimePurchaseOfferDetails();
            if (offer == null) continue;
            JSObject entry = new JSObject();
            entry.put("id", id);
            entry.put("price", offer.getFormattedPrice());
            products.put(entry);
        }
        JSObject out = new JSObject();
        out.put("products", products);
        call.resolve(out);
    }

    private void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code != BillingClient.BillingResponseCode.OK || purchases == null) {
            finishBuy(statusFor(code));
            return;
        }
        String status = "error";
        for (Purchase purchase : purchases) {
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                consume(purchase);
                status = "purchased";
            } else if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING && !status.equals("purchased")) {
                // Cash or bank transfer: Play confirms later, and the next
                // start consumes it (consumeLeftovers).
                status = "pending";
            }
        }
        finishBuy(status);
    }

    /**
     * A tip paid while the app was not running — a pending payment that
     * cleared, or a flow killed mid-way — is still owned and unconsumed.
     * Consuming it on every connect acknowledges it before Play's three-day
     * refund and frees the product to be bought again.
     */
    private void consumeLeftovers() {
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                for (Purchase purchase : purchases) {
                    if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) consume(purchase);
                }
            });
    }

    private void consume(Purchase purchase) {
        client.consumeAsync(
            ConsumeParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(),
            (result, token) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    // Retried by consumeLeftovers on the next start.
                    Log.w(TAG, "Consume failed: " + result.getResponseCode());
                }
            });
    }

    private static String statusFor(int code) {
        return code == BillingClient.BillingResponseCode.USER_CANCELED ? "cancelled" : "error";
    }

    private void finishBuy(String status) {
        PluginCall call;
        synchronized (this) {
            call = pendingBuy;
            pendingBuy = null;
        }
        if (call == null) return;
        JSObject out = new JSObject();
        out.put("status", status);
        call.resolve(out);
    }
}
