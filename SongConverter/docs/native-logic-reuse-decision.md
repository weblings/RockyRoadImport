# Reusing existing native-language logic in a browser tool

When a browser tool needs functionality that already exists as working, tested logic in
another language — especially binary-format parsing, cryptography, or other
correctness-critical code — there are two ways to get it into the browser: **compile and
reuse the original code**, or **hand-port it to JavaScript/TypeScript**. This doc lays out
the trade-off in general terms, for reference the next time this decision comes up.

## Option A — Compile-and-reuse via WebAssembly

Compile the relevant subset of the existing code to WebAssembly (if a WASM toolchain
exists for its source language) and call it from JS through an interop boundary, instead
of re-implementing the logic.

**Pros:**
- No porting-fidelity risk — it's the same code that was already working, not a
  reinterpretation of it.
- Single source of truth. Fixes and improvements made to the original logic apply to the
  browser tool automatically, with no second implementation to keep in sync.

**Cons:**
- Larger download payload — a compiled runtime plus the relevant assemblies/modules is
  typically megabytes, even after trimming/optimization, versus near-zero for hand-written
  JS.
- A second build toolchain to maintain alongside the browser project's normal one.
- If the source logic lives inside a larger project with unrelated dependencies (UI
  frameworks, OS-specific APIs, native bindings), those often don't compile for the target
  runtime and have to be isolated into a dependency-clean subset first.
- Compiling successfully doesn't guarantee correct behavior at runtime — platform-specific
  APIs (cryptography providers, native crypto/compression bridges, etc.) can compile fine
  and then fail or behave differently once actually executed under the new runtime. This
  needs an actual runtime smoke test against real input, not just a successful build.

## Option B — Hand-port to the target language

Rewrite the logic natively in the browser tool's own language.

**Pros:**
- Smallest possible bundle — no extra runtime, no compiled assets beyond ordinary JS.
- No second toolchain; fits the target project idiomatically, same build/test/deploy path
  as everything else in it.

**Cons:**
- Real risk of subtle bugs in non-trivial ports: exact binary layouts, endianness,
  cryptographic mode details, off-by-one errors, and other fine details are easy to get
  wrong in ways that don't show up until tested against real-world input.
- Ongoing double-maintenance burden if the source logic keeps evolving after the port —
  every future fix has to be manually re-applied to the ported copy.

## Guidance

Default to checking whether existing logic can be reused before reimplementing it — reuse
over duplication. Lean toward **Option A** when the logic is substantial and/or risky to
re-derive (binary formats, crypto, parsers) and a WASM toolchain exists for its source
language. Lean toward **Option B** when the logic is small and stable, or the target
platform genuinely can't host a second runtime.

If going with Option A, isolate a dependency-clean subset of the source logic first if it
lives inside a larger project — don't try to compile the whole thing if only part of it is
actually needed, since unrelated dependencies (UI, OS-specific APIs) often won't compile
for the new target. And always run the compiled output against real input on the actual
target runtime before trusting it — a successful build is not the same as correct runtime
behavior, especially for anything touching cryptography or platform APIs that may have
restricted or missing implementations on the new target.

## This project

The `.psarc` (Rocksmith) import feature took Option A: the existing chart-conversion logic
was substantial (~2000 lines of binary-format/crypto/parsing code with no existing
JS/TS equivalent), already tested, and its source language had a mature WASM toolchain
available. The dependency-clean subset was isolated into its own library, referenced by
both the original desktop tool and a small WASM interop project exposing just the two
functions the browser UI needs. Runtime verification against a real file caught a genuine
platform-compatibility issue at the crypto layer that a successful compile alone would not
have revealed — bearing out the guidance above about testing actual runtime behavior, not
just build success.
