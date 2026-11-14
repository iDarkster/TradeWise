# TradeWise ER diagram source

The `.dot` files are editable Graphviz source for `TradeWise_ER_v1_11.pdf`.

- `00_complete_relationship_overview.dot`: compact full-schema relationship overview.
- `01`–`06`: domain-level diagrams with fields and key markers.

Regenerate an individual PNG with Graphviz, for example:

    dot -Tpng 01_identity_and_access.dot -o identity.png

The PDF was reverse-engineered from `backend/prisma/schema.prisma` (the uploaded
schema snapshot) and cross-checked against the five SQL migrations in
`backend/prisma/migrations/`. If the schema or migrations change, update and
review these sources and regenerate the PDF. The diagrams show declared
Prisma foreign-key relationships; SQL-only checks/triggers are summarized
in the PDF notes page.
