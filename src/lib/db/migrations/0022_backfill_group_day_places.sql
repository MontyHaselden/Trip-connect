-- Backfill main-group calendar paint into group_day_places where missing (idempotent).
INSERT INTO "group_day_places" (
  "trip_id", "group_id", "date", "primary_city", "secondary_city",
  "primary_share", "day_type", "calendar_label", "weather_location_query"
)
SELECT
  d."trip_id",
  g."id",
  d."date",
  COALESCE(d."city_label", ''),
  d."secondary_city_label",
  CASE
    WHEN d."secondary_city_label" IS NULL OR trim(d."secondary_city_label") = '' THEN 1
    WHEN d."day_type" = 'travel' THEN 0.25
    ELSE 0.5
  END,
  COALESCE(d."day_type", 'trip'),
  d."calendar_label",
  d."weather_location_query"
FROM "trip_days" d
INNER JOIN "groups" g ON g."trip_id" = d."trip_id" AND g."is_main" = true
WHERE (
  trim(COALESCE(d."city_label", '')) <> ''
  OR trim(COALESCE(d."secondary_city_label", '')) <> ''
)
AND NOT EXISTS (
  SELECT 1
  FROM "group_day_places" gdp
  WHERE gdp."trip_id" = d."trip_id"
    AND gdp."group_id" = g."id"
    AND gdp."date" = d."date"
)
ON CONFLICT ("trip_id", "group_id", "date") DO NOTHING;
