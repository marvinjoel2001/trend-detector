from functools import lru_cache

from app.core.config import get_settings

CATEGORIES = {
    "gaming": ["game", "gaming", "esports", "minecraft", "fortnite", "stream"],
    "music": ["song", "music", "dance", "album", "concert", "beat", "dj"],
    "lifestyle": ["routine", "fitness", "travel", "fashion", "home", "wellness"],
    "memes": ["meme", "funny", "lol", "parody", "reaction", "viral joke"],
    "news": ["breaking", "news", "election", "war", "policy", "update"],
    "technology": ["ai", "tech", "gadget", "robot", "software", "startup", "code"],
    "finance": ["stock", "crypto", "money", "invest", "market", "finance", "trading"],
    "education": ["learn", "tutorial", "lesson", "course", "study", "explained"],
}


@lru_cache
def _nlp():
    try:
        import spacy

        settings = get_settings()
        return spacy.load(settings.spacy_model)
    except Exception:  # noqa: BLE001
        return None


def categorize_text(title: str, metadata: dict | None = None) -> str:
    metadata = metadata or {}
    blob = f"{title} {' '.join(str(v) for v in metadata.values())}".lower()

    doc = _nlp()(blob) if _nlp() else None
    tokens = {t.lemma_.lower() for t in doc if not t.is_stop} if doc else set(blob.split())

    best = ("lifestyle", 0)
    for category, keywords in CATEGORIES.items():
        score = sum(1 for keyword in keywords if keyword in tokens or keyword in blob)
        if score > best[1]:
            best = (category, score)
    return best[0]

