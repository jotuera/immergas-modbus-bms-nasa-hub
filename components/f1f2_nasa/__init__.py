"""Samsung NASA bus (F1/F2) for ESPHome - Immergas Magis Pro / Combo (Samsung EHS outdoor unit).

Part of jotuera/immergas-modbus-bms-nasa-opentherm-hub - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
"""

import os
import re

import yaml

import esphome.codegen as cg
from esphome.components import uart
import esphome.config_validation as cv
from esphome.const import CONF_ID
from esphome.core import CORE
from esphome import pins

CODEOWNERS = ["@jotuera"]
DEPENDENCIES = ["uart"]
MULTI_CONF = False

DOMAIN = "f1f2_nasa"
CONF_F1F2_NASA_ID = "f1f2_nasa_id"
CONF_LANGUAGE = "language"
CONF_NAME_PREFIX = "name_prefix"
CONF_ADDRESS = "address"
CONF_INDOOR_ADDRESS = "indoor_address"
CONF_OUTDOOR_ADDRESS = "outdoor_address"
CONF_READ_ADDRESS = "read_address"
CONF_TRANSMIT = "transmit"
CONF_QUIET_TIME = "quiet_time"
CONF_RESPONSE_TIMEOUT = "response_timeout"
CONF_MAX_ATTEMPTS = "max_attempts"
CONF_POLL_INTERVAL = "poll_interval"
CONF_REPUBLISH_INTERVAL = "republish_interval"
CONF_FLOW_CONTROL_PIN = "flow_control_pin"
CONF_SNIFFER = "sniffer"

# shared platform keys
CONF_KEY = "key"
CONF_FSV = "fsv"
CONF_PDU = "pdu"
CONF_SOURCE = "source"
CONF_TYPE = "type"
CONF_POLL = "poll"
CONF_SIGNED = "signed"
CONF_HIGH_WORD = "high_word"
CONF_MULTIPLY = "multiply"
CONF_NAN_VALUES = "nan_values"

f1f2_nasa_ns = cg.esphome_ns.namespace("f1f2_nasa")
NasaHub = f1f2_nasa_ns.class_("NasaHub", cg.Component, uart.UARTDevice)

# ------------------------------------------------------------------ catalog / translations

_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_yaml(*parts):
    with open(os.path.join(_DIR, *parts), encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


CATALOG = _load_yaml("f1f2_catalog.yaml")
FSV = _load_yaml("f1f2_fsv_catalog.yaml")["fsv"]
LANGUAGES = sorted(
    f[len("f1f2_") : -len(".yaml")]
    for f in os.listdir(os.path.join(_DIR, "translations"))
    if f.startswith("f1f2_") and f.endswith(".yaml")
)
_TRANSLATIONS = {}


def translation(lang):
    """Language file merged over English (missing keys fall back to English)."""
    if lang not in _TRANSLATIONS:
        base = _load_yaml("translations", "f1f2_en.yaml")
        if lang != "en":
            for section, values in _load_yaml("translations", f"f1f2_{lang}.yaml").items():
                if isinstance(values, dict) and isinstance(base.get(section), dict):
                    merged = dict(base[section])
                    for k, v in values.items():
                        if isinstance(v, dict) and isinstance(merged.get(k), dict):
                            merged[k] = {**merged[k], **v}
                        else:
                            merged[k] = v
                    base[section] = merged
                else:
                    base[section] = values
        _TRANSLATIONS[lang] = base
    return _TRANSLATIONS[lang]


def current_language():
    raw = (CORE.raw_config or {}).get(DOMAIN) or {}
    if isinstance(raw, list):
        raw = raw[0] if raw else {}
    lang = str(raw.get(CONF_LANGUAGE, "en")).lower()
    return lang if lang in LANGUAGES else "en"


def tr():
    return translation(current_language())


def name_prefix():
    """Hub `name_prefix:` (e.g. "Immergas FF - " on a device shared with other buses), read like the language."""
    raw = (CORE.raw_config or {}).get(DOMAIN) or {}
    if isinstance(raw, list):
        raw = raw[0] if raw else {}
    return str(raw.get(CONF_NAME_PREFIX) or "")


def auto_name(text):
    """Entity name filled from the catalog / translation, with the hub name prefix."""
    return f"{name_prefix()}{text}"


def fsv_name(code):
    t = tr()
    return auto_name(t["fsv_format"].format(code=code, name=t["fsv"].get(code, "")))


def preset(entry):
    """Decoder settings for a catalog / FSV entry."""
    dec = entry.get("dec", "raw")
    signed = entry.get("signed", dec == "temp")
    mul = entry.get("mul", 0.1 if dec == "temp" else 1.0)
    nan = list(entry.get("nan", []))
    if dec == "temp":
        nan += [0xFFFF, 0xFE0C]
    elif dec == "enum":
        nan += [0xFF]
    elif entry.get("nan_default", True) and dec == "raw" and entry.get("pdu") is not None:
        kind = (entry["pdu"] >> 9) & 3
        if kind == 1 and entry.get("cat") != "diagnostic":
            nan += [0xFFFF]
    return {
        CONF_SIGNED: bool(signed),
        CONF_HIGH_WORD: bool(entry.get("hi", False)),
        CONF_MULTIPLY: float(mul),
        CONF_NAN_VALUES: sorted(set(nan)),
    }


# ------------------------------------------------------------------ validators


def nasa_address(value):
    value = cv.string_strict(value)
    m = re.fullmatch(r"([0-9A-Fa-f]{2})\.([0-9A-Fa-f]{2})\.([0-9A-Fa-f]{2})", value)
    if not m:
        raise cv.Invalid("NASA address must look like 20.00.01 (three hex bytes)")
    return (int(m.group(1), 16) << 16) | (int(m.group(2), 16) << 8) | int(m.group(3), 16)


def resolve_source(source):
    """'indoor' / 'outdoor' / 'XX.XX.XX' -> 24-bit address (needs validated hub config)."""
    hub = CORE.config[DOMAIN]
    if source == "indoor":
        return hub[CONF_INDOOR_ADDRESS]
    if source == "outdoor":
        return hub[CONF_OUTDOOR_ADDRESS]
    return nasa_address(source)


SOURCE_SCHEMA = cv.Any(cv.one_of("indoor", "outdoor", lower=True), nasa_address)

CONFIG_SCHEMA = (
    cv.Schema(
        {
            cv.GenerateID(): cv.declare_id(NasaHub),
            cv.Optional(CONF_LANGUAGE, default="en"): cv.one_of(*LANGUAGES, lower=True),
            cv.Optional(CONF_NAME_PREFIX, default=""): cv.string,
            cv.Optional(CONF_ADDRESS, default="80.FF.00"): nasa_address,
            cv.Optional(CONF_INDOOR_ADDRESS, default="20.00.01"): nasa_address,
            cv.Optional(CONF_OUTDOOR_ADDRESS, default="10.00.00"): nasa_address,
            cv.Optional(CONF_READ_ADDRESS, default="B2.00.20"): nasa_address,
            cv.Optional(CONF_TRANSMIT, default=True): cv.boolean,
            cv.Optional(CONF_QUIET_TIME, default="100ms"): cv.positive_time_period_milliseconds,
            cv.Optional(CONF_RESPONSE_TIMEOUT, default="1s"): cv.positive_time_period_milliseconds,
            cv.Optional(CONF_MAX_ATTEMPTS, default=3): cv.int_range(min=1, max=10),
            cv.Optional(CONF_POLL_INTERVAL, default="30min"): cv.positive_time_period_milliseconds,
            cv.Optional(CONF_REPUBLISH_INTERVAL, default="60s"): cv.positive_time_period_milliseconds,
            cv.Optional(CONF_FLOW_CONTROL_PIN): pins.gpio_output_pin_schema,
            cv.Optional(CONF_SNIFFER, default=False): cv.boolean,
        }
    )
    .extend(cv.COMPONENT_SCHEMA)
    .extend(uart.UART_DEVICE_SCHEMA)
)

FINAL_VALIDATE_SCHEMA = uart.final_validate_device_schema(
    DOMAIN, baud_rate=9600, require_rx=True, data_bits=8, parity="EVEN", stop_bits=1
)


async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    await uart.register_uart_device(var, config)
    cg.add(var.set_address(config[CONF_ADDRESS]))
    cg.add(var.set_read_address(config[CONF_READ_ADDRESS]))
    cg.add(var.set_transmit(config[CONF_TRANSMIT]))
    cg.add(var.set_quiet_time(config[CONF_QUIET_TIME].total_milliseconds))
    cg.add(var.set_response_timeout(config[CONF_RESPONSE_TIMEOUT].total_milliseconds))
    cg.add(var.set_max_attempts(config[CONF_MAX_ATTEMPTS]))
    cg.add(var.set_poll_interval(config[CONF_POLL_INTERVAL].total_milliseconds))
    cg.add(var.set_republish_interval(config[CONF_REPUBLISH_INTERVAL].total_milliseconds))
    cg.add(var.set_sniffer(config[CONF_SNIFFER]))
    cg.add(var.set_indoor_address(config[CONF_INDOOR_ADDRESS]))
    cg.add(var.set_outdoor_address(config[CONF_OUTDOOR_ADDRESS]))
    for cls, label in sorted(translation(config[CONF_LANGUAGE]).get("device_classes", {}).items()):
        cg.add(var.add_class_label(int(cls), str(label)))
    # bus map: every message id of the catalog and the FSV list counts as described, also when this configuration
    # does not create its entity
    known = sorted({int(e["pdu"]) for e in list(CATALOG.values()) + list(FSV.values()) if isinstance(e, dict) and "pdu" in e})
    for pdu in known:
        cg.add(var.add_known_id(pdu))
    if CONF_FLOW_CONTROL_PIN in config:
        pin = await cg.gpio_pin_expression(config[CONF_FLOW_CONTROL_PIN])
        cg.add(var.set_flow_control_pin(pin))


# ------------------------------------------------------------------ helpers for platforms

HUB_ID_SCHEMA = cv.Schema({cv.GenerateID(CONF_F1F2_NASA_ID): cv.use_id(NasaHub)})


def fill_from_catalog(section, extra=None):
    """Pre-validator: fill name/unit/... from the catalog + translation for `key:`."""

    def validator(config):
        if not isinstance(config, dict):
            return config
        config = dict(config)
        defaults = {}
        if CONF_KEY in config:
            key = str(config[CONF_KEY])
            entries = CATALOG.get(section, {})
            if key not in entries:
                raise cv.Invalid(
                    f"Unknown key '{key}'. Known: {', '.join(sorted(entries))}", [CONF_KEY]
                )
            entry = entries[key]
            defaults["name"] = auto_name(tr().get(section, {}).get(key, key))
            mapping = {
                "unit": "unit_of_measurement",
                "dc": "device_class",
                "sc": "state_class",
                "acc": "accuracy_decimals",
                "icon": "icon",
                "cat": "entity_category",
            }
            for src, dst in mapping.items():
                if src in entry:
                    defaults[dst] = entry[src]
        if extra is not None:
            defaults.update(extra(config))
        for k, v in defaults.items():
            config.setdefault(k, v)
        return config

    return validator


def catalog_entry(section, config):
    entry = dict(CATALOG[section][str(config[CONF_KEY])])
    return entry
