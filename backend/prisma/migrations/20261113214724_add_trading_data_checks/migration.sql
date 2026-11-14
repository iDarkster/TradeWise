-- Decision 2: Enforce trading-data invariants at the database level.

-- Scenario candle constraints
ALTER TABLE "ScenarioCandle"
ADD CONSTRAINT "ScenarioCandle_ohlc_positive_check"
CHECK ("open" > 0 AND "high" > 0 AND "low" > 0 AND "close" > 0);

ALTER TABLE "ScenarioCandle"
ADD CONSTRAINT "ScenarioCandle_high_low_relationship_check"
CHECK (
  "high" >= "low"
  AND "high" >= "open"
  AND "high" >= "close"
  AND "low" <= "open"
  AND "low" <= "close"
);

ALTER TABLE "ScenarioCandle"
ADD CONSTRAINT "ScenarioCandle_volume_nonnegative_check"
CHECK ("volume" >= 0);

-- Order constraints
ALTER TABLE "Order"
ADD CONSTRAINT "Order_quantity_positive_check"
CHECK ("quantity" > 0);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_limit_price_positive_check"
CHECK ("limitPrice" IS NULL OR "limitPrice" > 0);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_type_limit_price_consistency_check"
CHECK (
  ("type" = 'LIMIT' AND "limitPrice" IS NOT NULL)
  OR
  ("type" = 'MARKET' AND "limitPrice" IS NULL)
);

-- Trade constraints
ALTER TABLE "Trade"
ADD CONSTRAINT "Trade_executed_quantity_positive_check"
CHECK ("executedQty" > 0);

ALTER TABLE "Trade"
ADD CONSTRAINT "Trade_executed_price_positive_check"
CHECK ("executedPrice" > 0);

ALTER TABLE "Trade"
ADD CONSTRAINT "Trade_total_value_positive_check"
CHECK ("totalValue" > 0);

-- Holding constraints
ALTER TABLE "Holding"
ADD CONSTRAINT "Holding_quantity_positive_check"
CHECK ("quantity" > 0);

ALTER TABLE "Holding"
ADD CONSTRAINT "Holding_average_buy_price_positive_check"
CHECK ("averageBuyPrice" > 0);
