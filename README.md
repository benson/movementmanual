# movement manual

a searchable pilates exercise repository.

**live site:** [bensonperry.com/movementmanual](https://bensonperry.com/movementmanual)

## features

- browse 91 pilates exercises with images
- filter by goals, muscle groups, and starting position
- exclude exercises by contraindications
- search with autocomplete
- grid and list view toggle
- detailed exercise view with breath cues, watch points, modifications, and variations
- mobile-friendly with sticky search/filter bar

## data

exercise data extracted from a pilates instructor training manual. includes:
- 21 goal categories
- 21 muscle groups
- 13 contraindications
- 10 starting positions
- 250+ images

## development

static site, no build step. to run locally:

```bash
python3 -m http.server 8001
```

then open [localhost:8001](http://localhost:8001).

## credits

- code written entirely by [claude code](https://claude.ai/claude-code)
- exercise content from pilates instructor training materials
