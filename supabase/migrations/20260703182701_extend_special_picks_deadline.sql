-- Extend the special picks deadline by 24 hours from now. Only the 4
-- podium categories + top scorer are gated by this field — 'surprise' no
-- longer uses it, its deadline is now the dynamic post-final voting window
-- (see 20260703180740_special_scoring_and_survey.sql).
UPDATE scoring_config
SET deadline = now() + interval '24 hours',
    updated_at = now()
WHERE stage IN ('special_first', 'special_second', 'special_third', 'special_fourth', 'special_scorer');
