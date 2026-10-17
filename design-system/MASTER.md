# Design system: Phantom Exchange account area

**Product.** The account side of an exchange: sign in, secure the account, add withdrawal addresses, deposit, withdraw, see balances. People use it to move money, so it is plain, dense, and serious.

**Pattern.** Left navigation on desktop, bottom navigation on phones (Overview, Deposit, Withdraw, Security). One main action per screen.

**Style.** Noir. Flat black surfaces, 1px borders at low opacity, no shadows on panels, no gradients, no glass.

**Color.** Neutrals plus one accent (amber, used for the main action and the current page). Green and red are status colors only and always sit next to text or an icon. No blue or purple anywhere.

**Type.** Geist for text, JetBrains Mono for numbers, addresses, and codes. Scale 12, 14, 16, 20, 24, 32. Weights 400, 500, 600.

**Spacing and shape.** 4px base, layout in 8px steps. Radius 4 and 8 only.

**Motion.** Short color transitions only. Respects reduced motion.

**Forms.** Visible labels, inline errors next to the field that say how to fix it, an error summary on submit.

**Avoid.** Everything under Hard Bans in the Hermes design skill, plus: money amounts rounded up, truncated addresses with no way to read them in full.
