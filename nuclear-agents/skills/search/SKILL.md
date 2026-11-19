---
name: search
description: Build search in a Synapsis product: a repository query with filters, sorting and pagination, full-text matching, input limits, and a debounced search box on the client. Use when users look things up by text, filter a list or page through results.
title: Search, filters and pagination
title_es: Búsqueda, filtros y paginación
description_es: Construir búsqueda en un producto Synapsis: una consulta de repositorio con filtros, orden y paginación, texto completo, límites de la entrada y debounce en el cliente. Úsalo cuando los usuarios buscan por texto, filtran una lista o pasan páginas de resultados.
kind: domain
tags: [search, full-text, filters, pagination, sorting, debounce, query, autocomplete]
---
# Search, filters and pagination

## When to use

A search box, a filtered list, an autocomplete, "load more" or numbered pages.

## Steps

1. **Decide what is searched.** `nuclear gen resource` gives a stored resource no `search` on purpose: which
   columns are searched is a decision. Write it down: the text fields (`title`, `description`), the filters
   (status, category, price range, date range), the sort orders, the page size.
2. **The query model** (`nuclear make model catalog BookQuery`): `text: string?` with `@maxLength(100)`,
   each filter optional, `sort` limited to a known list, `page: int` with `@min(1)`, `size: int` with `@min(1)`
   and `@max(100)` (default 20). Never accept a raw column name or an SQL fragment from the client.
3. **The repository method** builds one query: `where({...})` with `ilike` for a case-insensitive match
   (`"%" + text + "%"`), `oneOf` for a set of categories, `between` for ranges, `gte`/`lte` for open ranges,
   `orderBy(field, desc = ...)` with a **stable tie-breaker** (the id), and `paginate(page, size)` → `Page<T>`
   (`items`, `page`, `size`, `total`, `pages`). Escape `%` and `_` in the user's text.
4. **Wire it**: `nuclear gen usecase catalog SearchBooks --calls BookRepository.search --route "GET books/search"`.
   Extra rules (only published books for anonymous users) go in a hand-written use case.
5. **Indexes**: `@column(index = true)` on every filtered and sorted column; then `nuclear migrate make
   "search indexes"`. `ilike '%x%'` cannot use a normal index: for large tables use the database's full-text
   search (PostgreSQL `tsvector`, a trigram index) written in the migration file, or an external search engine as
   an HTTP repository. Measure with `nuclear run --monitor` and `nuclear monitor`.
6. **Deep pages**: `offset` gets slow and shifts when rows are inserted; for infinite scroll on big tables use a
   cursor (`where({ "id": lt(lastId) })` + `orderBy("id", desc = true)` + `limit(size)`).
7. **Empty and edge results**: an empty text lists the default order (or nothing, for autocomplete); no match
   answers an empty page (200), not 404; a page past the end answers empty items with the real `total`.
8. **The client**: `nuclear gen resource catalog Book --from-json <sample> --screen books` gives the repository
   and a list screen; add a search use case and a state manager method. **Debounce** the text field (300-400 ms),
   ignore texts shorter than 2-3 characters for autocomplete, and drop stale answers: keep the latest query and
   ignore an answer for an older one. Show loading, empty, error and results states (a `statemodel`).
9. **Offline or small sets** on mobile: query the local table (`local<Book>().where(...)`) instead of the network.
10. **Remember the query** in the route (`/books?text=x&page=2`) on web so it can be shared and survives a reload.

## The platform's tools

- `nuclear gen resource <component> <Name> --source db --actions list,get` and `nuclear gen usecase ... --calls <Repository>.<method> --route "GET ..."`
- Repository words: `where`, `ilike`, `like`, `oneOf`, `between`, `gte`, `lte`, `lt`, `orderBy`, `limit`,
  `offset`, `paginate`, `count` (`nuclear help backend`, §2.2).
- `nuclear make model <component> <Name>` for the query model; `nuclear make statemanager <component> <screen> <name>` (mobile).
- `nuclear migrate make <message>` for indexes; `nuclear monitor` after `nuclear run --monitor`.

## Pitfalls

- One request per keystroke and answers arriving out of order (old results overwrite new ones).
- No upper bound on `size`: one request dumps the table.
- Sorting without a unique tie-breaker: rows repeat or vanish between pages.
- `%` and `_` from the user acting as wildcards; unbounded text length.
- Counting the total on every page of a huge table: cache it or show "more" instead of a number.
- Searching private rows: the owner filter is part of the query, not applied after.

## Checklist

- [ ] The searched columns, filters and sorts are written in the spec and nowhere wider.
- [ ] `size` has a maximum; `sort` accepts only known values; the text has `@maxLength`.
- [ ] Every filtered or sorted column has an index (a migration).
- [ ] Order is stable (an id tie-breaker); a test pages through and sees every row once.
- [ ] The client debounces and ignores stale answers; empty, loading and error states exist.
- [ ] `nuclear check .` reports 0 errors and `nuclear test` is green.
