# PS2 → PSP Agent

Autonomous Perplexity API-powered agent that attempts to convert a PS2 game folder into a PSP game folder by orchestrating external tools, code generation, and iterative refinement.

> ⚠️ **Disclaimer**: This project is experimental and cannot guarantee playable, legal, or high-quality outputs. Use only with games you legally own.

## High-Level Flow

1. User provides:
   - Path to PS2 game folder
   - Perplexity API key
2. Agent analyzes contents (ELF, assets, scripts, etc.).
3. Agent plans a PSP target structure and transformation steps.
4. Agent iteratively:
   - Generates helper scripts/tools (C/C++/Python/etc.)
   - Calls external CLI tools (e.g., texture/model/audio converters, ISO/CSO builders)
   - Reduces model poly count, resamples textures/audio, rewrites configs
   - Tracks state and handles errors, generating a final report on failure.

## Disclaimer

- This repo does **not** include any game assets.
- You are responsible for complying with copyright law.
- Results are not guaranteed to boot or be stable on real PSP hardware.
