# Security Specification for Plant Data Firestore

## Data Invariants
1. Lotes must have a valid non-empty identifier.
2. Documents cannot be written with oversized malicious payloads.
3. Every operation in plant data belongs to authorized plant personnel.
4. Public reads and writes are strictly forbidden outside of plant operations.
5. Deletions are restricted to valid IDs.

## Collections Covered
- `/lotes/{loteId}`
- `/humedades/{humedadId}`
- `/analisisHumedo/{analisisId}`
- `/analisisSeco/{analisisId}`
- `/presecados/{presecadoId}`
- `/batchesVaporizado/{batchId}`
- `/batchLotes/{batchLoteId}`
- `/controlesVaporizado/{controlId}`
- `/analisisVaporizados/{analisisId}`
- `/programaciones/{programacionId}`
- `/systemConfig/{configId}`
- `/auditLogs/{logId}`
