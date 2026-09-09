"""Server-side chart generation for the OQZARO analysis page.

Charts are rendered with seaborn/matplotlib into compact PNGs and returned as
base64 "data:" URIs so the frontend can display real chart images without
mirroring every chart in recharts. All charting is bounded and defensive —
any failure degrades to an empty section rather than breaking analysis.
"""

import base64
import io
import logging

import pandas as pd

logger = logging.getLogger(__name__)

# Dark theme palette matching the OQZARO UI (accent blue #4f7cff).
_BG = "#0f172a"
_PANEL = "#1e293b"
_GRID = "#334155"
_TEXT = "#e2e8f0"
_MUTED = "#94a3b8"
_ACCENT = "#4f7cff"
_PALETTE = [
    "#4f7cff",
    "#8b5cf6",
    "#38bdf8",
    "#34d399",
    "#a78bfa",
    "#fb7185",
    "#facc15",
    "#4ade80",
]

# Hard caps so a response never balloons (images stay small).
MAX_HISTOGRAMS = 4
MAX_GROUP_BARS = 4
MAX_SCATTERS = 2
MAX_BOXPLOTS = 4
MAX_POINTS_PER_SCATTER = 250

_matplotlib = None
_plt = None
_sns = None
_FONT = None


def _ensure_backend():
    """Import plotting libraries (once) with aggressive deferral of failure."""
    global _matplotlib, _plt, _sns, _FONT
    if _plt is not None:
        return True
    try:
        import matplotlib  # type: ignore

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt  # type: ignore
        from matplotlib import font_manager  # type: ignore

        import seaborn as sns  # type: ignore

        # Prefer a font that has Arabic glyphs; otherwise keep the default.
        _FONT = None
        for family in (
            "Noto Naskh Arabic",
            "Noto Sans Arabic",
            "DejaVu Sans",
        ):
            try:
                font_manager.findfont(family, fallback_to_default=False)
                _FONT = family
                break
            except Exception:
                continue
        if _FONT:
            plt.rcParams["font.family"] = _FONT
        plt.rcParams["axes.unicode_minus"] = False
        plt.rcParams["figure.facecolor"] = _BG
        plt.rcParams["axes.facecolor"] = _BG
        plt.rcParams["savefig.facecolor"] = _BG
        plt.rcParams["axes.edgecolor"] = _GRID
        plt.rcParams["axes.labelcolor"] = _TEXT
        plt.rcParams["xtick.color"] = _MUTED
        plt.rcParams["ytick.color"] = _MUTED
        plt.rcParams["text.color"] = _TEXT
        plt.rcParams["axes.titlesize"] = 10
        plt.rcParams["axes.titlecolor"] = _TEXT
        plt.rcParams["grid.color"] = _GRID
        plt.rcParams["legend.facecolor"] = _PANEL
        plt.rcParams["legend.edgecolor"] = _GRID

        _matplotlib, _plt, _sns = matplotlib, plt, sns
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Charting libraries unavailable: %s", exc)
        return False


def _shape(text):
    """Shape Arabic text for RTL rendering (best effort)."""
    if not text:
        return ""
    try:
        import arabic_reshaper  # type: ignore
        from bidi.algorithm import get_display  # type: ignore

        return get_display(arabic_reshaper.reshape(str(text)))
    except Exception:
        return str(text)


def _to_data_uri(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
    buf.seek(0)
    return f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"


# Chart rendering is visual only — plotting more points changes nothing a human
# can see. Cap every series so 1M-row datasets render fast.
_PLOT_CAP = 5000


def _cap(series, cap=_PLOT_CAP):
    if series is None or len(series) <= cap:
        return series
    step = max(1, len(series) // cap)
    return series.iloc[::step].head(cap)


def _close(fig):
    try:
        _plt.close(fig)
    except Exception:
        pass


def _numeric_subset(df):
    return [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]


def _categorical_subset(df):
    out = []
    for c in df.columns:
        try:
            numeric = pd.api.types.is_numeric_dtype(df[c])
        except Exception:
            numeric = True
        if not numeric:
            out.append(c)
    return out


def _histograms(df, numeric_cols):
    charts = []
    for col in numeric_cols[:MAX_HISTOGRAMS]:
        try:
            s = pd.to_numeric(df[col], errors="coerce").dropna()
            if s.empty:
                continue
            if s.nunique() <= 1:
                continue
            fig, ax = _plt.subplots(figsize=(4.6, 2.6))
            _sns.histplot(_cap(s), kde=True, color=_ACCENT, ax=ax)
            ax.set_title(_shape(f"توزيع «{col}»"))
            ax.set_xlabel(_shape(col))
            ax.set_ylabel(_shape("العدد"))
            ax.grid(True, alpha=0.25)
            _sns.despine(ax=ax, top=True, right=True)
            charts.append({"column": str(col), "title": f"توزيع «{col}»", "image": _to_data_uri(fig)})
            _close(fig)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Histogram failed for %s: %s", col, exc)
    return charts


def _boxplots(df, numeric_cols):
    charts = []
    for col in numeric_cols[:MAX_BOXPLOTS]:
        try:
            s = pd.to_numeric(df[col], errors="coerce").dropna()
            if s.empty or s.nunique() <= 1:
                continue
            fig, ax = _plt.subplots(figsize=(4.6, 2.6))
            bp = ax.boxplot(
                [_cap(s).values],
                patch_artist=True,
                orientation="horizontal",
                widths=0.5,
            )
            if bp.get("boxes"):
                bp["boxes"][0].set_facecolor(_PANEL)
                bp["boxes"][0].set_edgecolor(_ACCENT)
            if bp.get("medians"):
                bp["medians"][0].set_color(_ACCENT)
            ax.set_title(_shape(f"مربع القيم «{col}»"))
            ax.set_xlabel(_shape(col))
            ax.grid(True, alpha=0.25)
            charts.append({"column": str(col), "title": f"مربع القيم «{col}»", "image": _to_data_uri(fig)})
            _close(fig)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Boxplot failed for %s: %s", col, exc)
    return charts


def _group_bars(df, cat_cols):
    charts = []
    for col in cat_cols[:MAX_GROUP_BARS]:
        try:
            counts = df[col].dropna().astype(str).value_counts().head(10)
            if counts.empty or len(counts) < 2:
                continue
            fig, ax = _plt.subplots(figsize=(4.6, 2.6))
            labels = [_shape(str(k))[:24] for k in counts.index]
            n_bars = len(labels)
            palette = (_PALETTE * ((n_bars // len(_PALETTE)) + 1))[:n_bars]
            _sns.barplot(
                x=labels,
                y=counts.values,
                hue=labels,
                palette=palette,
                legend=False,
                ax=ax,
            )
            ax.set_title(_shape(f"توزيع فئات «{col}»"))
            ax.set_xlabel(_shape(col))
            ax.set_ylabel(_shape("العدد"))
            ax.tick_params(axis="x", rotation=35)
            ax.grid(True, axis="y", alpha=0.25)
            _sns.despine(ax=ax, top=True, right=True)
            charts.append({"column": str(col), "title": f"توزيع فئات «{col}»", "image": _to_data_uri(fig)})
            _close(fig)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Group bar chart failed for %s: %s", col, exc)
    return charts


def _scatter(df, numeric_cols):
    if len(numeric_cols) < 2:
        return []
    charts = []
    cols = numeric_cols[:6]
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            if len(charts) >= MAX_SCATTERS:
                break
            x_c, y_c = cols[i], cols[j]
            try:
                sub = df[[x_c, y_c]].apply(pd.to_numeric, errors="coerce").dropna()
                if len(sub) < 5:
                    continue
                step = max(1, len(sub) // MAX_POINTS_PER_SCATTER)
                sampled = sub.iloc[::step].head(MAX_POINTS_PER_SCATTER)
                fig, ax = _plt.subplots(figsize=(4.6, 2.8))
                ax.scatter(
                    sampled[x_c],
                    sampled[y_c],
                    s=14,
                    alpha=0.65,
                    color=_ACCENT,
                    edgecolors="none",
                )
                ax.set_title(_shape(f"علاقة «{x_c}» و«{y_c}»"))
                ax.set_xlabel(_shape(str(x_c)))
                ax.set_ylabel(_shape(str(y_c)))
                ax.grid(True, alpha=0.25)
                charts.append(
                    {
                        "x_column": str(x_c),
                        "y_column": str(y_c),
                        "title": f"علاقة «{x_c}» و«{y_c}»",
                        "image": _to_data_uri(fig),
                    }
                )
                _close(fig)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Scatter failed for %s/%s: %s", x_c, y_c, exc)
        if len(charts) >= MAX_SCATTERS:
            break
    return charts


def _heatmap(df, numeric_cols):
    if not numeric_cols:
        return None
    try:
        sub = df[numeric_cols[:12]].apply(pd.to_numeric, errors="coerce").dropna(axis=1, how="all")
        if sub.shape[1] < 2:
            return None
        sub = _cap(sub)
        corr = sub.corr().fillna(0)
        fig, ax = _plt.subplots(figsize=(5.2, 4.0))
        _sns.heatmap(
            corr,
            annot=True,
            fmt=".2f",
            cmap="RdYlGn_r",
            center=0,
            ax=ax,
            cbar=False,
            linewidths=0.4,
            linecolor=_GRID,
            annot_kws={"color": _TEXT, "fontsize": 7},
            xticklabels=[_shape(str(c))[:18] for c in corr.columns],
            yticklabels=[_shape(str(c))[:18] for c in corr.index],
        )
        ax.set_title(_shape("مصفوفة الارتباط"))
        ax.tick_params(axis="x", rotation=45, labelsize=7)
        ax.tick_params(axis="y", rotation=0, labelsize=7)
        image = _to_data_uri(fig)
        _close(fig)
        return {"title": "مصفوفة الارتباط", "image": image}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Heatmap failed: %s", exc)
        return None


def charts_for_dataframe(df):
    """Generate a bounded set of chart images for a dataframe.

    Returns {histograms, boxplots, group_by, scatter, heatmap}. Each chart is
    {..., "image": "data:image/png;base64,..."} so the frontend can drop it into
    an <img> directly. Returns empty sections when plotting is unavailable.
    """
    if not _ensure_backend():
        return {
            "histograms": [],
            "boxplots": [],
            "group_by": [],
            "scatter": [],
            "heatmap": None,
        }
    if df is None or df.empty:
        return {
            "histograms": [],
            "boxplots": [],
            "group_by": [],
            "scatter": [],
            "heatmap": None,
        }
    try:
        numeric_cols = _numeric_subset(df)
        cat_cols = _categorical_subset(df)
        return {
            "histograms": _histograms(df, numeric_cols),
            "boxplots": _boxplots(df, numeric_cols),
            "group_by": _group_bars(df, cat_cols),
            "scatter": _scatter(df, numeric_cols),
            "heatmap": _heatmap(df, numeric_cols),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("charts_for_dataframe failed: %s", exc)
        return {
            "histograms": [],
            "boxplots": [],
            "group_by": [],
            "scatter": [],
            "heatmap": None,
        }
