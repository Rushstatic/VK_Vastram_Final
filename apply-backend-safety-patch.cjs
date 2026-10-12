const fs = require("fs");

function patchFile(file, replacements) {
  let source = fs.readFileSync(file, "utf8");
  for (const [label, oldText, newText] of replacements) {
    const count = source.split(oldText).length - 1;
    if (count !== 1) {
      throw new Error(`${file}: expected exactly one match for "${label}", found ${count}. No further edits made to this file.`);
    }
    source = source.replace(oldText, newText);
    console.log(`PATCHED ${file}: ${label}`);
  }
  fs.writeFileSync(file, source, "utf8");
}

patchFile("src/services/orderService.ts", [
  [
    "reject checkout without Supabase",
`    if (!isSupabaseConfigured()) {
      const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      return {
        isValid: true,
        hasPriceChanges: false,
        hasStockError: false,
        authoritativeSubtotal: subtotal,
        validatedItems: items,
      };
    }`,
`    if (!isSupabaseConfigured()) {
      return {
        isValid: false,
        hasPriceChanges: false,
        hasStockError: true,
        stockErrorMessage: 'Checkout is temporarily unavailable. Please try again shortly.',
        authoritativeSubtotal: 0,
        validatedItems: [],
      };
    }`
  ],
  [
    "handle product query errors",
`      const { data: dbProducts } = await (supabase as any)
        .from('products')
        .select(\`
          id,
          name,
          price,
          status,
          variants:product_variants(id, sku, price_override, stock_quantity, reserved_quantity, is_active)
        \`)
        .in('id', productIds);

      const priceChangeMessages: string[] = [];`,
`      const { data: dbProducts, error: productQueryError } = await (supabase as any)
        .from('products')
        .select(\`
          id,
          name,
          price,
          status,
          variants:product_variants(id, sku, price_override, stock_quantity, reserved_quantity, is_active)
        \`)
        .in('id', productIds);

      if (productQueryError) throw productQueryError;
      if (!Array.isArray(dbProducts)) throw new Error('Product validation returned no usable data.');

      const priceChangeMessages: string[] = [];`
  ],
  [
    "reject unavailable product status",
`        if (!dbProd || dbProd.status === 'archived') {`,
`        if (!dbProd || dbProd.status !== 'active') {`
  ],
  [
    "require a valid active variant",
`        const dbVariant = dbProd.variants?.find((v: any) =>
          item.variantId ? v.id === item.variantId : true
        );

        const currentPrice = Number(dbVariant?.price_override || dbProd.price || item.product.price);
        const physicalStock = Number(dbVariant?.stock_quantity ?? 10);
        const reservedStock = Number(dbVariant?.reserved_quantity ?? 0);`,
`        const availableVariants = (dbProd.variants || []).filter((v: any) => v.is_active !== false);
        const dbVariant = item.variantId
          ? availableVariants.find((v: any) => v.id === item.variantId)
          : availableVariants.length === 1 ? availableVariants[0] : undefined;

        if (!dbVariant) {
          hasStockError = true;
          stockErrorMessage = \`"\${item.product.name}" has no valid selected variant. Please refresh your bag and try again.\`;
          return item;
        }

        const currentPrice = Number(dbVariant.price_override ?? dbProd.price);
        const physicalStock = Number(dbVariant.stock_quantity);
        const reservedStock = Number(dbVariant.reserved_quantity ?? 0);
        if (!Number.isFinite(currentPrice) || currentPrice < 0 ||
            !Number.isFinite(physicalStock) || !Number.isFinite(reservedStock) ||
            physicalStock < 0 || reservedStock < 0) {
          hasStockError = true;
          stockErrorMessage = \`Unable to verify price or stock for "\${item.product.name}". Please try again.\`;
          return item;
        }`
  ],
  [
    "fail closed on validation exception",
`    } catch {
      const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      return {
        isValid: true,
        hasPriceChanges: false,
        hasStockError: false,
        authoritativeSubtotal: subtotal,
        validatedItems: items,
      };
    }`,
`    } catch (error) {
      console.error('Checkout catalog validation failed:', error);
      return {
        isValid: false,
        hasPriceChanges: false,
        hasStockError: true,
        stockErrorMessage: 'We could not verify current prices and stock. Please try again.',
        authoritativeSubtotal: 0,
        validatedItems: [],
      };
    }`
  ],
  [
    "reject unsuccessful server order response",
`        if (serverResponse.ok) {
          const srvData = await serverResponse.json();
          if (srvData.success && srvData.orderId) {
            if (paymentMethod === 'cod') {
              cartService.clearGuestCart();
            }
            return {
              success: true,
              orderId: srvData.orderId,
              orderNumber: srvData.orderNumber,
              guestAccessToken: srvData.guestAccessToken,
            };
          }
        }
      } catch (srvErr) {
        console.warn('Backend /api/orders/create call fell back to direct client insertion:', srvErr);
      }`,
`        const srvData = await serverResponse.json().catch(() => ({}));
        if (!serverResponse.ok || !srvData.success || !srvData.orderId) {
          return {
            success: false,
            error: srvData.error || 'The order service could not create your order. Please try again.',
          };
        }

        if (paymentMethod === 'cod') {
          cartService.clearGuestCart();
        }
        return {
          success: true,
          orderId: srvData.orderId,
          orderNumber: srvData.orderNumber,
          guestAccessToken: srvData.guestAccessToken,
        };
      } catch (srvErr) {
        console.error('Backend order creation request failed:', srvErr);
        return {
          success: false,
          error: 'Unable to reach the order service. No order was created. Please try again.',
        };
      }`
  ]
]);

patchFile("server.ts", [
  [
    "fail safely when inventory release fails",
`        if (orderStatus === 'cancelled' && currentOrderStatus !== 'cancelled'){
          if (db) {
            try {
              await db.rpc('release_inventory_for_order', {
                p_order_id: id,
                p_reason: notes || 'Cancelled by administrator',
              });
            } catch (err) {
              console.warn('RPC release_inventory_for_order failed, falling back to local simulation:', err);
              await releaseInMemoryReservation(id);
            }
          } else {
            await releaseInMemoryReservation(id);
          }
        }`,
`        if (orderStatus === 'cancelled' && currentOrderStatus !== 'cancelled') {
          if (!db) {
            res.status(503).json({ success: false, error: 'Persistent inventory storage is unavailable. Order was not cancelled.' });
            return;
          }

          const { data: releaseResult, error: releaseError } = await db.rpc('release_inventory_for_order', {
            p_order_id: id,
            p_reason: notes || 'Cancelled by administrator',
          });

          if (releaseError || releaseResult?.success === false) {
            console.error('Inventory release failed; cancellation aborted:', releaseError || releaseResult);
            res.status(409).json({
              success: false,
              error: 'Inventory could not be released. The order was not cancelled; retry after resolving the inventory issue.',
            });
            return;
          }
        }`
  ]
]);

console.log('\nPatch complete. Review git diff and run the build before doing anything else.');
