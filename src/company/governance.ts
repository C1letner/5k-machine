export type ExecutiveRole="CEO"|"CRO"|"CIO"|"CTO"|"CFO_COO"|"INDEPENDENT_AUDITOR";
export const OWNER_RISK_POSTURE="MEDIUM" as const;
export const AUTHORIZED_TO_TRADE=false as const;
export const governance={
 owner:{role:"OWNER",riskPosture:OWNER_RISK_POSTURE},
 CEO:{reportsTo:"OWNER",objective:"Positive net financial outcomes after all costs, subject to survival and Owner authority."},
 CRO:{reportsTo:"CEO",objective:"Reproducible falsifiable forward-surviving discoveries."},
 CIO:{reportsTo:"CEO",objective:"Portfolio proposals from validated research.",realCapitalAuthorityUsd:0},
 CTO:{reportsTo:"CEO",objective:"Reliable secure reproducible infrastructure."},
 CFO_COO:{reportsTo:"CEO",objective:"True economics, cost accounting and reconciliation."},
 INDEPENDENT_AUDITOR:{reportsTo:"OWNER",objective:"Independent evidence and control assurance."}
} as const;
export function requiresOwnerApproval(action:string){
 return ["ENABLE_REAL_TRADING","CHANGE_RISK_POSTURE","INCREASE_CAPITAL_AUTHORITY","NEW_PAID_SERVICE","WITHDRAW_FUNDS"].includes(action);
}
