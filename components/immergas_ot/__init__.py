"""OpenTherm for Immergas boilers - the hub as the OpenTherm master or as a gateway (room unit <-> boiler).

Part of jotuera/immergas-modbus-bms-nasa-opentherm-hub - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
"""

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome import pins
from esphome.const import CONF_ID, CONF_MODE

CODEOWNERS = ["@jotuera"]
MULTI_CONF = False

DOMAIN = "immergas_ot"
CONF_IMMERGAS_OT_ID = "immergas_ot_id"
CONF_BOILER = "boiler"
CONF_ROOM = "room"
CONF_IN_PIN = "in_pin"
CONF_OUT_PIN = "out_pin"
CONF_IN_ACTIVE_LOW = "in_active_low"
CONF_OUT_ACTIVE_LOW = "out_active_low"
CONF_STATUS_LOW_BYTE = "status_low_byte"
CONF_STANDALONE_AFTER = "standalone_after"
CONF_CACHE_READS = "cache_reads"
CONF_MAX_CH_FOLLOWS_SETPOINT = "max_ch_follows_setpoint"

# shared platform keys
CONF_DATA_ID = "data_id"
CONF_VALUE_TYPE = "value_type"
CONF_SOURCE = "source"
CONF_POLL = "poll"
CONF_BIT = "bit"

immergas_ot_ns = cg.esphome_ns.namespace("immergas_ot")
OtHub = immergas_ot_ns.class_("OtHub", cg.Component)
Mode = immergas_ot_ns.enum("Mode")
MODES = {"master": Mode.MODE_MASTER, "gateway": Mode.MODE_GATEWAY}

# value types: how the 16-bit value of a Data-ID is read (index = the C++ ValueType enum)
VALUE_TYPES = {"f88": 0, "u16": 1, "s16": 2, "u8_hb": 3, "u8_lb": 4, "s8_hb": 5, "s8_lb": 6}
SOURCES = {"boiler": False, "room": True}

LINE_SCHEMA = cv.Schema(
    {
        cv.Required(CONF_IN_PIN): pins.internal_gpio_input_pin_schema,
        cv.Required(CONF_OUT_PIN): pins.internal_gpio_output_pin_schema,
        # the common adapters: output LOW = line active, input HIGH = line active
        cv.Optional(CONF_IN_ACTIVE_LOW, default=False): cv.boolean,
        cv.Optional(CONF_OUT_ACTIVE_LOW, default=True): cv.boolean,
    }
)


def _gateway_needs_room(config):
    if config[CONF_MODE] == "gateway" and CONF_ROOM not in config:
        raise cv.Invalid("mode: gateway needs the `room:` adapter (the slave side towards the room unit)")
    return config


CONFIG_SCHEMA = cv.All(
    cv.Schema(
        {
            cv.GenerateID(): cv.declare_id(OtHub),
            cv.Optional(CONF_MODE, default="master"): cv.one_of(*MODES, lower=True),
            cv.Required(CONF_BOILER): LINE_SCHEMA,
            cv.Optional(CONF_ROOM): LINE_SCHEMA,
            # low byte of the status request: 0xCA = the "Immergas fix" (without it some boilers acknowledge
            # Data-ID 1 / 57 writes and ignore them); 0x00 = plain OpenTherm
            cv.Optional(CONF_STATUS_LOW_BYTE, default=0xCA): cv.hex_uint8_t,
            # gateway: without a request of the room unit for this long the hub runs the boiler itself
            cv.Optional(CONF_STANDALONE_AFTER, default="8s"): cv.positive_time_period_milliseconds,
            # gateway: answer a read of the room unit from a value younger than this (0 = never) and use the boiler
            # slot for the hub's own reads
            cv.Optional(CONF_CACHE_READS, default="0s"): cv.positive_time_period_milliseconds,
            # the original Immergas room unit writes the max. CH setpoint (57) with the CH setpoint (1), same value;
            # some Immergas boilers heat to 57 and ignore 1. The hub's own 57 then caps the CH setpoint.
            cv.Optional(CONF_MAX_CH_FOLLOWS_SETPOINT, default=True): cv.boolean,
        }
    ).extend(cv.COMPONENT_SCHEMA),
    _gateway_needs_room,
)

HUB_CHILD_SCHEMA = cv.Schema({cv.GenerateID(CONF_IMMERGAS_OT_ID): cv.use_id(OtHub)})


async def _line(var, setter, conf):
    pin_in = await cg.gpio_pin_expression(conf[CONF_IN_PIN])
    pin_out = await cg.gpio_pin_expression(conf[CONF_OUT_PIN])
    cg.add(getattr(var, setter)(pin_in, pin_out, conf[CONF_IN_ACTIVE_LOW], conf[CONF_OUT_ACTIVE_LOW]))


async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    cg.add(var.set_mode(MODES[config[CONF_MODE]]))
    await _line(var, "set_master_pins", config[CONF_BOILER])
    if CONF_ROOM in config:
        await _line(var, "set_room_pins", config[CONF_ROOM])
    cg.add(var.set_status_low_byte(config[CONF_STATUS_LOW_BYTE]))
    cg.add(var.set_standalone_after(config[CONF_STANDALONE_AFTER].total_milliseconds))
    cg.add(var.set_cache_reads(config[CONF_CACHE_READS].total_milliseconds))
    cg.add(var.set_max_ch_follows(config[CONF_MAX_CH_FOLLOWS_SETPOINT]))
