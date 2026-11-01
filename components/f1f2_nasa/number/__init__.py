import esphome.codegen as cg
from esphome.components import number
import esphome.config_validation as cv
from esphome.const import CONF_MAX_VALUE, CONF_MIN_VALUE, CONF_STEP

from .. import (
    CONF_FSV,
    CONF_F1F2_NASA_ID,
    CONF_HIGH_WORD,
    CONF_MULTIPLY,
    CONF_NAN_VALUES,
    CONF_PDU,
    CONF_SIGNED,
    CONF_SOURCE,
    DOMAIN,
    FSV,
    HUB_ID_SCHEMA,
    SOURCE_SCHEMA,
    f1f2_nasa_ns,
    fsv_name,
    preset,
    resolve_source,
)

DEPENDENCIES = [DOMAIN]

NasaNumber = f1f2_nasa_ns.class_("NasaNumber", number.Number)


def _fill(config):
    """Pre-validator: name / unit / icon from the FSV catalog for `fsv:`."""
    if not isinstance(config, dict):
        return config
    config = dict(config)
    if CONF_FSV in config:
        code = int(config[CONF_FSV])
        if code not in FSV:
            raise cv.Invalid(f"Unknown FSV {code}", [CONF_FSV])
        e = FSV[code]
        config.setdefault("name", fsv_name(code))
        config.setdefault("icon", "mdi:cog")
        if "unit" in e:
            config.setdefault("unit_of_measurement", e["unit"])
    return config


CONFIG_SCHEMA = cv.All(
    _fill,
    number.number_schema(NasaNumber)
    .extend(HUB_ID_SCHEMA)
    .extend(
        {
            cv.Exclusive(CONF_FSV, "what"): cv.int_,
            cv.Exclusive(CONF_PDU, "what"): cv.hex_uint16_t,
            cv.Optional(CONF_SOURCE): SOURCE_SCHEMA,
            cv.Optional(CONF_SIGNED): cv.boolean,
            cv.Optional(CONF_HIGH_WORD): cv.boolean,
            cv.Optional(CONF_MULTIPLY): cv.float_,
            cv.Optional(CONF_MIN_VALUE, default=0.0): cv.float_,
            cv.Optional(CONF_MAX_VALUE, default=70.0): cv.float_,
            cv.Optional(CONF_STEP, default=0.5): cv.positive_float,
        }
    ),
    cv.has_exactly_one_key(CONF_FSV, CONF_PDU),
)


async def to_code(config):
    hub = await cg.get_variable(config[CONF_F1F2_NASA_ID])

    if CONF_FSV in config:
        entry = dict(FSV[int(config[CONF_FSV])])
        pdu, source = entry["pdu"], "indoor"
    else:
        entry = {"pdu": config[CONF_PDU], "dec": "raw"}
        pdu, source = config[CONF_PDU], config.get(CONF_SOURCE, "indoor")

    dec = preset(entry)
    for k in (CONF_SIGNED, CONF_HIGH_WORD, CONF_MULTIPLY):
        if k in config:
            dec[k] = config[k]
    if CONF_SOURCE in config:
        source = config[CONF_SOURCE]

    var = await number.new_number(
        config,
        min_value=config[CONF_MIN_VALUE],
        max_value=config[CONF_MAX_VALUE],
        step=config[CONF_STEP],
    )
    cg.add(var.set_message_id(pdu))
    cg.add(var.set_source(resolve_source(source) if isinstance(source, str) else source))
    cg.add(var.set_poll(True))
    cg.add(var.set_signed(dec[CONF_SIGNED]))
    cg.add(var.set_high_word(dec[CONF_HIGH_WORD]))
    cg.add(var.set_multiply(dec[CONF_MULTIPLY]))
    for n in dec[CONF_NAN_VALUES]:
        cg.add(var.add_nan_value(n))
    cg.add(var.set_hub(hub))
    cg.add(hub.register_writable(pdu))
    cg.add(hub.register_listener(var))
