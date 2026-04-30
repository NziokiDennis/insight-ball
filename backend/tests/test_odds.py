from app.core.backtest import backtest_rows
from app.core.model import PredictionInput, predict
from app.core.odds import OddsSet, consensus_probabilities, devig_odds, expected_value, overround


def test_devig_probabilities_sum_to_one():
    probabilities = devig_odds({"home": 2.1, "draw": 3.2, "away": 3.6})

    assert round(sum(probabilities.values()), 10) == 1.0
    assert probabilities["home"] > probabilities["away"]
    assert overround({"home": 2.1, "draw": 3.2, "away": 3.6}) > 0


def test_expected_value_uses_model_probability_against_decimal_odds():
    assert round(expected_value(0.52, 2.3), 3) == 0.196


def test_consensus_rejects_clear_outlier_when_many_sources_exist():
    consensus, rejected = consensus_probabilities(
        [
            OddsSet(2.0, 3.4, 3.8, "book-a"),
            OddsSet(2.05, 3.3, 3.7, "book-b"),
            OddsSet(8.0, 1.4, 8.0, "bad-feed"),
        ]
    )

    assert "bad-feed" in rejected
    assert consensus["home"] > consensus["away"]


def test_prediction_returns_value_fields():
    result = predict(PredictionInput(home_odds=2.1, draw_odds=3.2, away_odds=3.6))

    assert result["home_probability"] > result["away_probability"]
    assert "expected_value" in result
    assert result["most_likely_outcome"] == "home"


def test_backtest_reads_football_data_style_rows():
    rows = [
        {"FTR": "H", "B365H": "2.10", "B365D": "3.20", "B365A": "3.60"},
        {"FTR": "D", "B365H": "1.90", "B365D": "3.40", "B365A": "4.00"},
    ]

    result = backtest_rows(rows)

    assert result["evaluated_matches"] == 2
    assert result["bets"] >= 0
