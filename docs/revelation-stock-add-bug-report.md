# Bug report: `POST /api/stock/stockitem/add` cannot be called successfully over JSON

**Server:** `sqltest.omegaonline.co.za:13000`
**Observed:** 2026-07-14 / 2026-07-15
**Severity:** Blocking — no request payload can satisfy the endpoint.

## Summary

The `stockItem.stockPic` property is (a) required by model validation and
(b) typed as `System.Drawing.Bitmap`, which System.Text.Json cannot
deserialize. These two facts together make the endpoint impossible to call:

| `stockPic` sent as | Response |
| --- | --- |
| `null` (or omitted) | `400` — `"StockItem.StockPic": ["The StockPic field is required."]` |
| any JSON object (`{}`, full schema shape) | `500` with an **empty body** — `NotSupportedException` (Bitmap has no parameterless constructor) escapes the JSON-binding error handling |
| a JSON string | `400` — `"The JSON value could not be converted to System.Drawing.Bitmap. Path: $.stockItem.stockPic"` |
| a **valid base64 PNG** string (also tried as data URI, and with `hasPic: true` + `itemPicture` set) | `400` — same Bitmap conversion error, proving no custom base64→Bitmap converter is registered |

Every other validation issue can be resolved by the caller; this one cannot.

## Root cause (inferred from response behaviour)

The response pattern matches System.Text.Json's default binder exactly:

- A **string** token against an object-typed property throws `JsonException`
  → surfaces as a clean RFC 7807 `400` naming the target type
  (`System.Drawing.Bitmap`).
- An **object** token reaches instance creation, and `Bitmap` has no
  parameterless constructor → `NotSupportedException`, which is not a
  `JsonException`, so it bypasses the model-binding error handling and
  surfaces as a `500` with an empty body.
- `null` binds fine but then fails the `[Required]`/non-nullable validation.

A base64 string was explicitly tested to rule out a custom
`JsonConverter<Bitmap>`; it produced the same conversion error, so none is
registered. Note that binding aborts at the first bad property, so the
bodiless 500 masks any later errors in the payload.

## How to reproduce

`POST {base}/api/stock/stockitem/add` with a `{ companyNr, stockItem }` body
where `stockItem` contains every schema field populated with defaults
(non-null strings, zeroed numbers, non-null nested objects — this passes all
other validation), then vary only `stockPic`:

1. `"stockPic": null` → `400`, `"The StockPic field is required."`
2. `"stockPic": {}` → `500`, empty body
3. `"stockPic": "iVBORw0KGgo..."` (valid base64 PNG) → `400`,
   `"The JSON value could not be converted to System.Drawing.Bitmap"`

## Evidence (trace IDs from your server)

- Object → bodiless 500: reproduced repeatedly on 2026-07-14/15 (no trace ID
  returned — the response body is empty).
- Null → required: `traceId 00-92377e60fd811142b9a06b5b69a9d81d-2fce5053266a0fa0-01`
- String → Bitmap conversion error: `traceId 00-95252cf5a347b1291ebefbf80f5c9eb8-11a06cf4dc83c67f-01`
- Valid base64 PNG → same conversion error: `traceId 00-17c9d2cd05212228646cb7c6258c3412-bbfa96ebe28bd0e9-01`
- Base64 + `hasPic: true` + `itemPicture` set → same: `traceId 00-41862c6ca86c8fe9b7c584d4826be0f1-6a8e50f0ddf2eb54-01`
- `data:image/png;base64,…` URI → same: `traceId 00-69cf300a6c2a5f3916f8f1eace80ff1d-d30f6488c16d17d6-01`

## Secondary issue: read output cannot be round-tripped into add

`POST /api/stock/stockitem` (read) returns `null` for many fields that the
add endpoint then rejects as required, so a fetched item cannot be posted
back without client-side patching:

- Trailing code strings: `itemCd`, `iplCatCd`, `tlCatCd`, … return null;
  add responds `"The ItemCd field is required."` etc.
- Nested objects: `cat`, `bin`, `uD1`–`uD6` may be null on reads but are
  required objects on add.
- Nested nulls: `cat.cosAcc`…`cat.cosAcc30` return null on reads; add
  responds `"The COSAcc field is required."` etc.

(The same read/write asymmetry exists on the customer endpoints with
`loyaltyCardNo`.)

## Suggested fixes (any one unblocks integrators)

1. Make `StockPic` optional (nullable, or `[JsonIgnore]` on input) — the
   `itemPicture` base64 string field already exists as a JSON-friendly
   transport for the image.
2. Or replace the `System.Drawing.Bitmap` model property with a
   JSON-serializable type / custom converter.
3. Align read and write nullability so fetched items round-trip.
