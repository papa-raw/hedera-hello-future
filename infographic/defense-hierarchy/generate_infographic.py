#!/usr/bin/env python3
"""Generate Five-Level Defense Hierarchy infographic.

Redesign: L0-L4 pyramid with real mechanism examples,
sourced from ai-mech-atlas taxonomy + Ecospatial Parliament.
"""

from PIL import Image, ImageDraw, ImageFont
import math

# -- Dimensions (landscape 16:9 for slides / social) --
W, H = 1920, 1080
MARGIN = 80

# -- Color Palette (warm earth tones, Ecospatial aesthetic) --
BG       = "#FAF3E8"   # warm parchment
TEXT     = "#2C2418"    # warm near-black
TEXT_SEC = "#7A6E5E"    # muted brown
DIVIDER  = "#D8CCBA"    # warm divider

# Layer colors (distinct earth gradient: slate -> dusty blue -> sand -> sage -> terracotta)
L0_FILL = "#B8B0A4"    # warm slate
L1_FILL = "#B8C4CC"    # dusty blue-grey
L2_FILL = "#C8C4B0"    # warm sand
L3_FILL = "#C4C8A4"    # sage green
L4_FILL = "#D4B4A8"    # terracotta pink

L0_BORDER = "#8E8678"
L1_BORDER = "#8A9CA8"
L2_BORDER = "#A8A490"
L3_BORDER = "#949880"
L4_BORDER = "#B08878"

# Accent for "Here be Moloch" and status tags
MOLOCH   = "#A04030"    # muted red
LIVE_TAG = "#3D7A4A"    # green for "LIVE"
ATTEMPT  = "#B8862D"    # amber for "ATTEMPT"
UNSOLVED = "#A04030"    # red for "UNSOLVED"

def hex_to_rgb(h):
    return tuple(int(h.lstrip("#")[i:i+2], 16) for i in (0, 2, 4))

# -- Fonts --
FONT_TTC = "/System/Library/Fonts/Avenir Next.ttc"
GEORGIA  = "/System/Library/Fonts/Georgia.ttf"

def avenir(size, weight="Regular"):
    idx = {"Bold": 0, "Demi Bold": 2, "Medium": 5, "Regular": 7, "Heavy": 8}
    return ImageFont.truetype(FONT_TTC, size, index=idx.get(weight, 7))

def georgia(size, bold=False):
    if bold:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia Bold.ttf", size)
    return ImageFont.truetype(GEORGIA, size)

F_TITLE    = avenir(42, "Heavy")
F_SUBTITLE = avenir(18, "Medium")
F_LAYER_ID = avenir(20, "Demi Bold")
F_LAYER_NAME = avenir(26, "Bold")
F_LAYER_SUB  = avenir(14, "Medium")
F_BULLET   = avenir(14, "Regular")
F_BULLET_B = avenir(14, "Demi Bold")
F_TAG      = avenir(10, "Bold")
F_FOOTER   = avenir(13, "Medium")
F_FOOTER_SM = avenir(11, "Regular")
F_MOLOCH   = georgia(16, bold=True)
F_PRINCIPLE = georgia(15, bold=False)

# -- Helpers --
def center_text(draw, y, text, fnt, fill):
    bb = draw.textbbox((0, 0), text, font=fnt)
    tw = bb[2] - bb[0]
    draw.text(((W - tw) / 2, y), text, fill=fill, font=fnt)

def right_text(draw, x, y, text, fnt, fill):
    bb = draw.textbbox((0, 0), text, font=fnt)
    tw = bb[2] - bb[0]
    draw.text((x - tw, y), text, fill=fill, font=fnt)

def spaced_text(draw, x, y, text, fnt, fill, spacing=3):
    """Draw text with letter spacing."""
    for ch in text:
        draw.text((x, y), ch, fill=fill, font=fnt)
        bb = draw.textbbox((0, 0), ch, font=fnt)
        x += (bb[2] - bb[0]) + spacing
    return x

def draw_tag(draw, x, y, text, color):
    """Draw a small status tag."""
    bb = draw.textbbox((0, 0), text, font=F_TAG)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    pad_x, pad_y = 6, 3
    r = 3
    # rounded rect background
    x1, y1 = x, y
    x2, y2 = x + tw + pad_x * 2, y + th + pad_y * 2
    draw.rounded_rectangle([(x1, y1), (x2, y2)], radius=r, fill=color)
    draw.text((x1 + pad_x, y1 + pad_y - 1), text, fill="#FFFFFF", font=F_TAG)
    return x2

# -- Canvas --
img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# -- Title Block --
title_y = 36
center_text(draw, title_y, "FIVE-LEVEL DEFENSE HIERARCHY", F_TITLE, TEXT)
center_text(draw, title_y + 50, "Layered defenses against coordination failure", F_SUBTITLE, TEXT_SEC)

# -- Pyramid geometry --
# Pyramid sits in the left 55% of the canvas, bullets on the right
PYR_LEFT = 180
PYR_RIGHT = 980
PYR_TOP = 130
PYR_BOTTOM = 870

PYR_CX = (PYR_LEFT + PYR_RIGHT) / 2
PYR_W = PYR_RIGHT - PYR_LEFT

# Each layer is a horizontal slice of the pyramid (trapezoid)
# L0 at bottom (widest), L4 at top (narrowest)
LAYERS = [
    {
        "id": "L0", "name": "CRYPTOGRAPHIC", "sub": "Consensus, finality",
        "fill": L0_FILL, "border": L0_BORDER,
        "bullets": ["Consensus protocols", "Transaction finality", "Signature schemes", "Hash commitments"],
        "tag": None,
        "source": "Base layer (Ethereum, Cosmos)",
    },
    {
        "id": "L1", "name": "INDIVIDUAL", "sub": "Reward alignment, stakes",
        "fill": L1_FILL, "border": L1_BORDER,
        "bullets": ["Staking / slashing", "Reputation systems", "Bounded delegation", "Token-gated roles"],
        "tag": None,
        "source": "ERC-8004, Olas staking",
    },
    {
        "id": "L2", "name": "INTRA-SWARM", "sub": "Topology, verification",
        "fill": L2_FILL, "border": L2_BORDER,
        "bullets": ["Orchestration frameworks", "Verification networks", "Role assignment", "Shared state machines"],
        "tag": ("LIVE", LIVE_TAG),
        "source": "Ecospatial Parliament (145 agents)",
    },
    {
        "id": "L3", "name": "INTER-SWARM", "sub": "Cross-swarm coordination",
        "fill": L3_FILL, "border": L3_BORDER,
        "bullets": ["Cross-chain messaging", "Agent payment rails", "Interop standards (A2A, MCP)"],
        "extra_line": ("Shared ontologies", UNSOLVED),
        "tag": ("ATTEMPT", ATTEMPT),
        "source": "BKC cross-bioregion treaties",
    },
    {
        "id": "L4", "name": "ECOSYSTEM", "sub": "Governance of governance",
        "fill": L4_FILL, "border": L4_BORDER,
        "bullets": ["Futarchy", "Constitutional AI", "Exit rights / rage quit"],
        "tag": ("UNSOLVED", UNSOLVED),
        "source": None,
        "moloch": True,
    },
]

N = len(LAYERS)
layer_h = (PYR_BOTTOM - PYR_TOP) / N
gap = 4  # gap between layers

# Compute trapezoid coordinates for each layer
def layer_trapezoid(i):
    """Return (top_left, top_right, bot_left, bot_right) x coords and y range."""
    # i=0 is bottom, i=N-1 is top
    # At bottom: full width. At top: narrow.
    top_ratio = (i + 1) / N  # 0 at bottom edge, 1 at apex
    bot_ratio = i / N

    # Width narrows linearly
    top_half_w = (PYR_W / 2) * (1 - top_ratio * 0.82)
    bot_half_w = (PYR_W / 2) * (1 - bot_ratio * 0.82)

    y_bot = PYR_BOTTOM - i * layer_h
    y_top = PYR_BOTTOM - (i + 1) * layer_h + gap

    return {
        "tl": (PYR_CX - top_half_w, y_top),
        "tr": (PYR_CX + top_half_w, y_top),
        "bl": (PYR_CX - bot_half_w, y_bot),
        "br": (PYR_CX + bot_half_w, y_bot),
        "y_top": y_top,
        "y_bot": y_bot,
        "cy": (y_top + y_bot) / 2,
    }

# Draw layers bottom to top
BULLET_LEFT = 1020  # x where bullets start
DOT_R = 4

for i, layer in enumerate(LAYERS):
    trap = layer_trapezoid(i)

    # Draw filled trapezoid
    polygon = [trap["tl"], trap["tr"], trap["br"], trap["bl"]]
    draw.polygon(polygon, fill=layer["fill"], outline=layer["border"], width=2)

    # Layer ID (e.g. "L0") on the left outside the pyramid
    id_x = trap["bl"][0] - 40
    id_y = trap["cy"] - 12
    draw.text((id_x, id_y), layer["id"], fill=layer["border"], font=F_LAYER_ID)

    # Layer name centered in trapezoid
    bb_name = draw.textbbox((0, 0), layer["name"], font=F_LAYER_NAME)
    name_w = bb_name[2] - bb_name[0]
    name_x = PYR_CX - name_w / 2
    name_y = trap["cy"] - 18

    draw.text((name_x, name_y), layer["name"], fill=TEXT, font=F_LAYER_NAME)

    # Subtitle below name
    bb_sub = draw.textbbox((0, 0), layer["sub"], font=F_LAYER_SUB)
    sub_w = bb_sub[2] - bb_sub[0]
    sub_x = PYR_CX - sub_w / 2
    sub_y = name_y + 30
    draw.text((sub_x, sub_y), layer["sub"], fill=TEXT_SEC, font=F_LAYER_SUB)

    # "Here be Moloch" for L4
    if layer.get("moloch"):
        moloch_text = "Here be Moloch"
        bb_m = draw.textbbox((0, 0), moloch_text, font=F_MOLOCH)
        m_w = bb_m[2] - bb_m[0]
        m_x = trap["tr"][0] + 16
        m_y = trap["cy"] - 6
        draw.text((m_x, m_y), moloch_text, fill=MOLOCH, font=F_MOLOCH)

    # Bullets on the right side
    bullet_y = trap["y_top"] + 8
    bullet_spacing = 22

    # Tag (LIVE, ATTEMPT, UNSOLVED) next to layer
    if layer.get("tag"):
        tag_text, tag_color = layer["tag"]
        tag_x = BULLET_LEFT
        draw_tag(draw, tag_x, bullet_y - 2, tag_text, tag_color)
        bullet_y += 22

    for j, bullet in enumerate(layer["bullets"]):
        # Dot
        dot_x = BULLET_LEFT + 4
        dot_y = bullet_y + 7
        draw.ellipse(
            [(dot_x - DOT_R, dot_y - DOT_R), (dot_x + DOT_R, dot_y + DOT_R)],
            fill=layer["border"]
        )
        # Text
        draw.text((BULLET_LEFT + 16, bullet_y), bullet, fill=TEXT, font=F_BULLET)
        bullet_y += bullet_spacing

    # Extra line with UNSOLVED tag (for L3 shared ontologies)
    if layer.get("extra_line"):
        extra_text, extra_color = layer["extra_line"]
        dot_x = BULLET_LEFT + 4
        dot_y = bullet_y + 7
        draw.ellipse(
            [(dot_x - DOT_R, dot_y - DOT_R), (dot_x + DOT_R, dot_y + DOT_R)],
            fill=layer["border"]
        )
        draw.text((BULLET_LEFT + 16, bullet_y), extra_text, fill=TEXT, font=F_BULLET)
        # UNSOLVED tag after text
        bb_et = draw.textbbox((0, 0), extra_text, font=F_BULLET)
        tag_x = BULLET_LEFT + 16 + (bb_et[2] - bb_et[0]) + 8
        draw_tag(draw, tag_x, bullet_y + 1, "UNSOLVED", extra_color)
        bullet_y += bullet_spacing

    # Source annotation (small, right-aligned)
    if layer.get("source"):
        src_y = bullet_y + 2
        draw.text((BULLET_LEFT + 16, src_y), layer["source"], fill=TEXT_SEC, font=F_FOOTER_SM)

# -- Principle line --
principle_y = PYR_BOTTOM + 28
draw.line([(MARGIN + 40, principle_y), (W - MARGIN - 40, principle_y)], fill=DIVIDER, width=1)

principle_text = "Each layer depends on the integrity of layers below it"
center_text(draw, principle_y + 12, principle_text, F_PRINCIPLE, TEXT_SEC)

# -- Sources footer --
footer_y = principle_y + 48
sources = [
    "Sources: ai-mech-atlas L0-L5 taxonomy  |  Ecospatial Parliament V2 (L2 live, 145 agents)  |  BKC network (L3 attempt, 4 nodes)",
]
center_text(draw, footer_y, sources[0], F_FOOTER_SM, TEXT_SEC)

# Stat line - more honest framing
stat_y = footer_y + 22
stats = "50K+ agent tokens on Base  |  1.77M Olas service executions  |  60+ chains deployed  |  Q1 2026"
center_text(draw, stat_y, stats, F_FOOTER_SM, DIVIDER)

source_line2 = "Virtuals Protocol, Olas Network, DeFi Llama. '$479M agentic GDP' removed - methodology unverifiable."
center_text(draw, stat_y + 18, source_line2, F_FOOTER_SM, DIVIDER)

# -- Save --
out = "/Users/pat/Desktop/1_projects/regen-atlas-ecospatial/infographic/defense-hierarchy/infographic.png"
img.save(out, "PNG", dpi=(144, 144))
print(f"Saved {out} ({W}x{H})")
