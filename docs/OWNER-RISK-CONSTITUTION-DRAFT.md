# 5K Machine — Owner Risk Constitution (Draft)

Status: DRAFT ONLY. No trading authority.

Hard capital controls must ultimately live outside agent-editable research/strategy code and be enforced by credential/execution boundaries.

Owner decisions still required before capital:
- maximum portfolio drawdown
- maximum daily loss
- maximum gross/net exposure
- leverage cap
- per-asset / per-strategy allocation
- venue/counterparty cap
- order-rate/notional caps
- emergency halt rules

Non-negotiable architecture:
- Risk reports independently to Owner, not CIO.
- Trading credentials remain trade-disabled until explicit Owner approval; withdrawal permission must never be granted to the trading engine.
- Exchange is source of truth for positions/balances; disagreement with internal state halts new orders.
- Agents may propose risk changes but may not activate them.
