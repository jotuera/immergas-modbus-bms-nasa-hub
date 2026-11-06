"""immergas_ot text sensors: the Data-ID map (which IDs the boiler answers / does not know / the room unit uses)."""

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import text_sensor
from esphome.const import CONF_TYPE

from .. import CONF_IMMERGAS_OT_ID, HUB_CHILD_SCHEMA, immergas_ot_ns

DEPENDENCIES = ["immergas_ot"]
OtMapTextSensor = immergas_ot_ns.class_("OtMapTextSensor", text_sensor.TextSensor, cg.PollingComponent)
KINDS = {"ids_supported": 0, "ids_unknown": 1, "ids_room": 2}

CONFIG_SCHEMA = (
    text_sensor.text_sensor_schema(OtMapTextSensor)
    .extend({cv.Required(CONF_TYPE): cv.one_of(*KINDS, lower=True)})
    .extend(HUB_CHILD_SCHEMA)
    .extend(cv.polling_component_schema("30s"))
)


async def to_code(config):
    hub = await cg.get_variable(config[CONF_IMMERGAS_OT_ID])
    var = await text_sensor.new_text_sensor(config)
    await cg.register_component(var, config)
    cg.add(var.set_hub(hub))
    cg.add(var.set_kind(KINDS[config[CONF_TYPE]]))
