# Invalid `--sdk` value

Garbage `--sdk` values such as `54xyz` prevent analysis. Doctor exits `1` and `--json` emits `{ schemaVersion, error: { code: "INVALID_SDK", message } }` with no report fields.

## Sub-features

- `invalid-sdk-flag` rejects `--sdk 54xyz` with `error.code` `"INVALID_SDK"` and exit `1`.
- `invalid-sdk-equals` rejects `--sdk=54xyz` the same way.
- `invalid-sdk-payload` omits `recommendations`, `summary`, and `project`.
- `invalid-sdk-message` includes the garbage value `54xyz` in `error.message`.

## How to get to it (user POV)

- Run `nativeguard doctor --json --sdk 54xyz fixtures/sdk53-pager-view`.
- Run `nativeguard doctor --json --sdk=54xyz fixtures/sdk53-pager-view`.

## Driving it with verify-doctor

Preconditions:

- Baseline launch and doctor check have passed.
- `fixtures/sdk53-pager-view` exists (any supported fixture is acceptable; this one is the documented example).

- **Space form.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id invalid-sdk --feature doctor-invalid-sdk -- --sdk 54xyz fixtures/sdk53-pager-view`. Exit code `1`. `stdout.json` has `schemaVersion` `"1.0.0"` and `error.code` `"INVALID_SDK"`. `error.message` contains `54xyz`. The object has no `recommendations`, `summary`, or `project` keys.
- **Equals form.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id invalid-sdk-equals --feature doctor-invalid-sdk -- --sdk=54xyz fixtures/sdk53-pager-view`. Exit code `1` and the same `error.code`.
- **Proof.** Keep both artifact directories. `exit-code.txt` is `1`. The fixture is unchanged.

## Gotchas

- Valid soft strings such as `54`, `54beta`, and `54.0.0-beta.1` are not this feature. Those run analysis.
- `--sdk` with a missing value is also `INVALID_SDK`, but the mapped garbage token is `54xyz`.
- Error payloads are JSON on stdout when `--json` is set. Do not look only at stderr.
- This is not `unsupported`. `unsupported` still includes `recommendations`, `summary`, and `project`.
