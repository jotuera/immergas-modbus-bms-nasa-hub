"""immergas_ot binary sensors: type bit (a bit of a Data-ID value) or type state (boiler / room unit online, standalone)."""

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import binary_sensor
from esphome.const import CONF_STATE, CONF_TYPE

from .. import CONF_BIT, CONF_DATA_ID, CONF_IMMERGAS_OT_ID, CONF_POLL, CONF_SOURCE, HUB_CHILD_SCHEMA, SOURCES, immergas_ot_ns

DEPENDENCIES = ["immergas_ot"]
OtBinarySensor = immergas_ot_ns.class_("OtBinarySensor", binary_sensor.BinarySensor, cg.Component)
OtStateBinarySensor = immergas_ot_ns.class_("OtStateBinarySensor", binary_sensor.BinarySensor, cg.PollingComponent)
STATES = {"boiler_online": 0, "room_online": 1, "standalone": 2}

CONFIG_SCHEMA = cv.typed_schema(
    {
        "bit": binary_sensor.binary_sensor_schema(OtBinarySensor)
        .extend(
            {
                cv.Required(CONF_DATA_ID): cv.int_range(0, 255),
                cv.Required(CONF_BIT): cv.int_range(0, 15),
                cv.Optional(CONF_SOURCE, default="boiler"): cv.one_of(*SOURCES, lower=True),
                cv.Optional(CONF_POLL, default=True): cv.boolean,
            }
        )
        .extend(HUB_CHILD_SCHEMA)
        .extend(cv.COMPONENT_SCHEMA),
        "state": binary_sensor.binary_sensor_schema(OtStateBinarySensor)
        .extend({cv.Required(CONF_STATE): cv.one_of(*STATES, lower=True)})
        .extend(HUB_CHILD_SCHEMA)
        .extend(cv.polling_component_schema("5s")),
    },
    key=CONF_TYPE,
    default_type="bit",
)


async def to_code(config):
    hub = await cg.get_variable(config[CONF_IMMERGAS_OT_ID])
    var = await binary_sensor.new_binary_sensor(config)
    await cg.register_component(var, config)
    cg.add(var.set_hub(hub))
    if config[CONF_TYPE] == "state":
        cg.add(var.set_kind(STATES[config[CONF_STATE]]))
        return
    cg.add(var.set_data_id(config[CONF_DATA_ID]))
    cg.add(var.set_bit(config[CONF_BIT]))
    cg.add(var.set_from_room(SOURCES[config[CONF_SOURCE]]))
    cg.add(var.set_poll(config[CONF_POLL]))
