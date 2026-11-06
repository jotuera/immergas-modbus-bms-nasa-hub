"""immergas_ot sensors: type value (a Data-ID from the boiler answer or the room unit request) or type stat."""

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import sensor
from esphome.const import CONF_TYPE

from .. import (
    CONF_DATA_ID, CONF_IMMERGAS_OT_ID, CONF_POLL, CONF_SOURCE, CONF_VALUE_TYPE, HUB_CHILD_SCHEMA, SOURCES, VALUE_TYPES,
    immergas_ot_ns,
)

DEPENDENCIES = ["immergas_ot"]
CONF_STAT = "stat"
OtSensor = immergas_ot_ns.class_("OtSensor", sensor.Sensor, cg.Component)
OtStatSensor = immergas_ot_ns.class_("OtStatSensor", sensor.Sensor, cg.PollingComponent)
STATS = {"frames": 0, "errors": 1, "timeouts": 2}

CONFIG_SCHEMA = cv.typed_schema(
    {
        "value": sensor.sensor_schema(OtSensor)
        .extend(
            {
                cv.Required(CONF_DATA_ID): cv.int_range(0, 255),
                cv.Optional(CONF_VALUE_TYPE, default="f88"): cv.one_of(*VALUE_TYPES, lower=True),
                cv.Optional(CONF_SOURCE, default="boiler"): cv.one_of(*SOURCES, lower=True),
                cv.Optional(CONF_POLL, default=True): cv.boolean,
            }
        )
        .extend(HUB_CHILD_SCHEMA)
        .extend(cv.COMPONENT_SCHEMA),
        "stat": sensor.sensor_schema(OtStatSensor, accuracy_decimals=0)
        .extend({cv.Required(CONF_STAT): cv.one_of(*STATS, lower=True)})
        .extend(HUB_CHILD_SCHEMA)
        .extend(cv.polling_component_schema("60s")),
    },
    key=CONF_TYPE,
    default_type="value",
)


async def to_code(config):
    hub = await cg.get_variable(config[CONF_IMMERGAS_OT_ID])
    var = await sensor.new_sensor(config)
    await cg.register_component(var, config)
    cg.add(var.set_hub(hub))
    if config[CONF_TYPE] == "stat":
        cg.add(var.set_stat(STATS[config[CONF_STAT]]))
        return
    cg.add(var.set_data_id(config[CONF_DATA_ID]))
    cg.add(var.set_value_type(VALUE_TYPES[config[CONF_VALUE_TYPE]]))
    cg.add(var.set_from_room(SOURCES[config[CONF_SOURCE]]))
    cg.add(var.set_poll(config[CONF_POLL]))
