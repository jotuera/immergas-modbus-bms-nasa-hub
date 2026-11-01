import esphome.codegen as cg
from esphome.components import sensor
import esphome.config_validation as cv

from .. import (
    CATALOG,
    CONF_FSV,
    CONF_HIGH_WORD,
    CONF_F1F2_NASA_ID,
    CONF_KEY,
    CONF_MULTIPLY,
    CONF_NAN_VALUES,
    CONF_PDU,
    CONF_POLL,
    CONF_REPUBLISH_INTERVAL,
    CONF_SIGNED,
    CONF_SOURCE,
    CONF_TYPE,
    DOMAIN,
    FSV,
    HUB_ID_SCHEMA,
    SOURCE_SCHEMA,
    auto_name,
    fill_from_catalog,
    fsv_name,
    f1f2_nasa_ns,
    preset,
    resolve_source,
    tr,
)
from esphome.core import CORE

DEPENDENCIES = [DOMAIN]

NasaSensor = f1f2_nasa_ns.class_("NasaSensor", sensor.Sensor)

HUB_TYPES = ["rx_frames", "bad_frames", "tx_frames", "timeouts"]
_HUB_SETTERS = {
    "rx_frames": "set_rx_frames_sensor",
    "bad_frames": "set_crc_errors_sensor",
    "tx_frames": "set_tx_frames_sensor",
    "timeouts": "set_timeouts_sensor",
}


def _extra(config):
    d = {}
    if CONF_FSV in config:
        code = int(config[CONF_FSV])
        if code not in FSV:
            raise cv.Invalid(f"Unknown FSV {code}", [CONF_FSV])
        e = FSV[code]
        d["name"] = fsv_name(code)
        d["icon"] = "mdi:cog-outline"
        if "unit" in e:
            d["unit_of_measurement"] = e["unit"]
        d["accuracy_decimals"] = 1 if e.get("dec") == "temp" or e.get("mul", 1) < 1 else 0
    elif CONF_TYPE in config:
        t = str(config[CONF_TYPE])
        d["name"] = auto_name(tr()["sensors"].get(t, t))
        d["entity_category"] = "diagnostic"
        d["accuracy_decimals"] = 0
        d["icon"] = "mdi:counter"
    elif CONF_PDU in config:
        d["entity_category"] = "diagnostic"  # undecoded raw value
    return d


CONFIG_SCHEMA = cv.All(
    fill_from_catalog("sensors", _extra),
    sensor.sensor_schema(NasaSensor)
    .extend(HUB_ID_SCHEMA)
    .extend(
        {
            cv.Exclusive(CONF_KEY, "what"): cv.one_of(*CATALOG["sensors"].keys()),
            cv.Exclusive(CONF_FSV, "what"): cv.int_,
            cv.Exclusive(CONF_PDU, "what"): cv.hex_uint16_t,
            cv.Exclusive(CONF_TYPE, "what"): cv.one_of(*HUB_TYPES, lower=True),
            cv.Optional(CONF_SOURCE): SOURCE_SCHEMA,
            cv.Optional(CONF_POLL): cv.boolean,
            cv.Optional(CONF_SIGNED): cv.boolean,
            cv.Optional(CONF_HIGH_WORD): cv.boolean,
            cv.Optional(CONF_MULTIPLY): cv.float_,
            cv.Optional(CONF_NAN_VALUES): cv.ensure_list(cv.uint32_t),
        }
    ),
    cv.has_exactly_one_key(CONF_KEY, CONF_FSV, CONF_PDU, CONF_TYPE),
)


async def to_code(config):
    hub = await cg.get_variable(config[CONF_F1F2_NASA_ID])

    if CONF_TYPE in config:
        var = await sensor.new_sensor(config)
        cg.add(getattr(hub, _HUB_SETTERS[config[CONF_TYPE]])(var))
        return

    if CONF_KEY in config:
        entry = dict(CATALOG["sensors"][config[CONF_KEY]])
        pdu, source, poll = entry["pdu"], entry["src"], entry.get("poll", False)
    elif CONF_FSV in config:
        entry = dict(FSV[int(config[CONF_FSV])])
        pdu, source, poll = entry["pdu"], "indoor", True
    else:
        entry = {"pdu": config[CONF_PDU], "dec": "raw", "cat": "diagnostic"}
        pdu, source, poll = config[CONF_PDU], config.get(CONF_SOURCE, "indoor"), False

    dec = preset(entry)
    for k in (CONF_SIGNED, CONF_HIGH_WORD, CONF_MULTIPLY, CONF_NAN_VALUES):
        if k in config:
            dec[k] = config[k]
    if CONF_SOURCE in config:
        source = config[CONF_SOURCE]
    if CONF_POLL in config:
        poll = config[CONF_POLL]

    var = await sensor.new_sensor(config)
    cg.add(var.set_message_id(pdu))
    cg.add(var.set_source(resolve_source(source) if isinstance(source, str) else source))
    cg.add(var.set_poll(poll))
    cg.add(var.set_signed(dec[CONF_SIGNED]))
    cg.add(var.set_high_word(dec[CONF_HIGH_WORD]))
    cg.add(var.set_multiply(dec[CONF_MULTIPLY]))
    for n in dec[CONF_NAN_VALUES]:
        cg.add(var.add_nan_value(n))
    cg.add(
        var.set_republish_interval(
            CORE.config[DOMAIN][CONF_REPUBLISH_INTERVAL].total_milliseconds
        )
    )
    cg.add(hub.register_listener(var))
