# CRUD Quality Gate — 7 Post-Generation Checks

After generating CRUD (Create/Read/Update/Delete) code, verify these 7 items. These are common hidden errors that compile but fail at runtime.

| # | Check | What to Look For |
|---|-------|-----------------|
| 1 | Soft-delete annotation | Entities with logical delete must have `@Where(clause = "deleted = false")` or equivalent |
| 2 | Pagination boundary | List queries must enforce page size limits (default 20, max 100) |
| 3 | Validation layer | Input validation must be in the service/controller layer, not duplicated in entity annotations only |
| 4 | JPA N+1 query | Entity relationships must use `@EntityGraph` or `JOIN FETCH` to avoid N+1 selects |
| 5 | Transaction boundary | Write operations must be `@Transactional` with proper rollback configuration |
| 6 | Null-safety on optional fields | `Optional` return types must be checked with `.orElseThrow()` not `.get()` |
| 7 | Unique constraint handling | Database unique constraints must have corresponding `DataIntegrityViolationException` handling |
