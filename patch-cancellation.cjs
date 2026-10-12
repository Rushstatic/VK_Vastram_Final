const fs = require("fs");
const file = "server.ts";
const source = fs.readFileSync(file, "utf8");

const startMarker = "if (orderStatus === 'cancelled' && currentOrderStatus !== 'cancelled')";
const endMarker = "const actorName = req.user?.email || 'Admin';";

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0 || end <= start) {
  throw new Error("Cancellation block markers not found. No changes made.");
}

const oldBlock = source.slice(start, end);
if (!oldBlock.includes("release_inventory_for_order")) {
  throw new Error("Expected inventory RPC not found in cancellation block. No changes made.");
}

const replacement = `if (orderStatus === 'cancelled' && currentOrderStatus !== 'cancelled') {
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
        }

        `;

fs.writeFileSync(file, source.slice(0, start) + replacement + source.slice(end), "utf8");
console.log("PATCHED server.ts: cancellation now stops if inventory release fails.");
