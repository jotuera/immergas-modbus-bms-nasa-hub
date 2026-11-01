import esphome.codegen as cg
from esphome.components import binary_sensor
import esphome.config_validation as cv
from esphome.core import CORE

from .. import (
    CATALOG,
    CONF_F1F2_NASA_ID,
    CONF_KEY,
    CONF_PDU,
    CONF_REPUBLISH_INTERVAL,
    CONF_SOURCE,
    DOMAIN,
    HUB_ID_SCHEMA,
    SOURCE_SCHEMA,
    fill_from_catalog,
    f1f2_nasa_ns,
    resolve_source,
)

DEPENDENCIES = [DOMAIN]
CONF_MASK = "mask"

NasaBinarySensor = f1f2_nasa_ns.class_("NasaBinarySensor", binary_sensor.BinarySensor)

CONFIG_SCHEMA = cv.All(
    fill_from_catalog("binary_sensors"),
    binary_sensor.binary_sensor_schema(NasaBinarySensor)
    .extend(HUB_ID_SCHEMA)
    .extend(
        {
            cv.Exclusive(CONF_KEY, "what"): cv.one_of(*CATALOG["binary_sensors"].keys()),
            cv.Exclusive(CONF_PDU, "what"): cv.hex_uint16_t,
            cv.Optional(CONF_SOURCE): SOURCE_SCHEMA,
            cv.Optional(CONF_MASK): cv.uint32_t,
        }
    ),
    cv.has_exactly_one_key(CONF_KEY, CONF_PDU),
)


async def to_code(config):
    hub = await cg.get_variable(config[CONF_F1F2_NASA_ID])
    if CONF_KEY in config:
        entry = CATALOG["binary_sensors"][config[CONF_KEY]]
        pdu, source, mask = entry["pdu"], entry["src"], entry.get("mask", 0xFFFFFFFF)
    else:
        pdu, source, mask = config[CONF_PDU], "indoor", 0xFFFFFFFF
    source = config.get(CONF_SOURCE, source)
    mask = config.get(CONF_MASK, mask)
    var = await binary_sensor.new_binary_sensor(config)
    cg.add(var.set_message_id(pdu))
    cg.add(var.set_source(resolve_source(source) if isinstance(source, str) else source))
    cg.add(var.set_mask(mask))
    cg.add(
        var.set_republish_interval(
            CORE.config[DOMAIN][CONF_REPUBLISH_INTERVAL].total_milliseconds
        )
    )
    cg.add(hub.register_listener(var))
