import esphome.codegen as cg
from esphome.components import text_sensor
import esphome.config_validation as cv
from esphome.core import CORE

from .. import (
    CATALOG,
    CONF_F1F2_NASA_ID,
    CONF_KEY,
    CONF_PDU,
    CONF_REPUBLISH_INTERVAL,
    CONF_SOURCE,
    CONF_TYPE,
    DOMAIN,
    HUB_ID_SCHEMA,
    SOURCE_SCHEMA,
    auto_name,
    fill_from_catalog,
    f1f2_nasa_ns,
    resolve_source,
    tr,
)

DEPENDENCIES = [DOMAIN]
CONF_MODE = "mode"
CONF_OPTIONS = "options"

NasaTextSensor = f1f2_nasa_ns.class_("NasaTextSensor", text_sensor.TextSensor)
TextMode = f1f2_nasa_ns.enum("TextMode", is_class=True)
MODES = {"map": TextMode.MAP, "error": TextMode.MAP, "firmware": TextMode.FIRMWARE, "hex": TextMode.HEX}
HUB_TYPES = {
    "last_frame": "set_last_frame_text_sensor",
    "last_change": "set_last_change_text_sensor",
    "devices": "set_devices_text_sensor",
}


def _extra(config):
    if CONF_TYPE in config:
        t = str(config[CONF_TYPE])
        return {"name": auto_name(tr()["text_sensors"].get(t, t)), "entity_category": "diagnostic"}
    if CONF_PDU in config:
        return {"entity_category": "diagnostic"}  # undecoded raw value
    return {}


CONFIG_SCHEMA = cv.All(
    fill_from_catalog("text_sensors", _extra),
    text_sensor.text_sensor_schema(NasaTextSensor)
    .extend(HUB_ID_SCHEMA)
    .extend(
        {
            cv.Exclusive(CONF_KEY, "what"): cv.one_of(*CATALOG["text_sensors"].keys()),
            cv.Exclusive(CONF_PDU, "what"): cv.hex_uint16_t,
            cv.Exclusive(CONF_TYPE, "what"): cv.one_of(*HUB_TYPES, lower=True),
            cv.Optional(CONF_SOURCE): SOURCE_SCHEMA,
            cv.Optional(CONF_MODE): cv.one_of(*MODES, lower=True),
            cv.Optional(CONF_OPTIONS): cv.Schema({cv.uint32_t: cv.string}),
        }
    ),
    cv.has_exactly_one_key(CONF_KEY, CONF_PDU, CONF_TYPE),
)


def _printf_safe(s):
    return s.replace("%", "%%")


async def to_code(config):
    hub = await cg.get_variable(config[CONF_F1F2_NASA_ID])
    var = await text_sensor.new_text_sensor(config)
    if CONF_TYPE in config:
        cg.add(getattr(hub, HUB_TYPES[config[CONF_TYPE]])(var))
        return

    t = tr()
    options = {}
    if CONF_KEY in config:
        entry = CATALOG["text_sensors"][config[CONF_KEY]]
        pdu, source, mode = entry["pdu"], entry["src"], entry.get("mode", "map")
        cg.add(var.set_poll(entry.get("poll", False)))
        if mode == "map":
            options = dict(t["maps"].get(entry["map"], {}))
    else:
        pdu, source, mode = config[CONF_PDU], "indoor", "hex"
    source = config.get(CONF_SOURCE, source)
    mode = config.get(CONF_MODE, mode)

    texts = t["texts"]
    unknown = _printf_safe(texts["unknown"]).replace("{value}", "%u")
    if mode == "error":
        options = {0: texts["no_error"]}
        for code, text in t["errors"].items():
            options[int(code)] = texts["error_with_text"].format(code=code, text=text)
        unknown = _printf_safe(texts["error"]).replace("{code}", "%u")
    options.update(config.get(CONF_OPTIONS, {}))

    cg.add(var.set_message_id(pdu))
    cg.add(var.set_source(resolve_source(source) if isinstance(source, str) else source))
    cg.add(var.set_mode(MODES[mode]))
    cg.add(var.set_unknown_format(unknown))
    for value, text in sorted(options.items()):
        cg.add(var.add_option(int(value), str(text)))
    cg.add(
        var.set_republish_interval(
            CORE.config[DOMAIN][CONF_REPUBLISH_INTERVAL].total_milliseconds
        )
    )
    cg.add(hub.register_listener(var))
