"""Climate entity for an Immergas zone or the DHW cylinder, built on the hub's own number / select entities.

    climate:
      - platform: immergas_climate
        name: "Zone 1"
        kind: zone                      # zone | dhw
        target: zone1_setpoint_number   # number with the setpoint (read and written)
        operating_mode: return id(mode_reported);        # 0 standby, 1 summer, 2 cooling, 3 winter
        mode_select: operating_mode_select               # zone: OFF / HEAT / COOL -> summer / winter / cooling
        room_temperature: return id(room_raw) / 10.0f;   # NAN = unknown
        room_humidity: return id(hum_raw);               # optional
        zone_status: return id(zone1_status_raw);        # zone: PDU 2010 (request / Comfort / Eco / Manual)
        dhw_request: return id(dhw_request).state;       # dhw: heating the cylinder now
        levels:                                          # zone, optional: presets Comfort / Eco
          comfort_heat: comfort_heat_number
          eco_heat: eco_heat_number
          comfort_cool: comfort_cool_number
          eco_cool: eco_cool_number
"""
import esphome.codegen as cg
from esphome.components import climate, number, select
import esphome.config_validation as cv
from esphome.const import CONF_ID

CODEOWNERS = ["@jotuera"]
DEPENDENCIES = ["climate"]

ns = cg.esphome_ns.namespace("immergas_climate")
ImmergasClimate = ns.class_("ImmergasClimate", climate.Climate, cg.PollingComponent)
Kind = ns.enum("Kind", is_class=True)
KINDS = {"zone": Kind.ZONE, "dhw": Kind.DHW}

LEVELS = ("comfort_heat", "eco_heat", "comfort_cool", "eco_cool")


def _check(config):
    zone = config["kind"] == "zone"
    if zone and "zone_status" not in config:
        raise cv.Invalid("kind: zone needs zone_status")
    if not zone and "dhw_request" not in config:
        raise cv.Invalid("kind: dhw needs dhw_request")
    return config


CONFIG_SCHEMA = cv.All(
    climate.climate_schema(ImmergasClimate)
    .extend(
        {
            cv.Required("kind"): cv.enum(KINDS, lower=True),
            cv.Required("target"): cv.use_id(number.Number),
            cv.Required("operating_mode"): cv.returning_lambda,
            cv.Required("room_temperature"): cv.returning_lambda,
            cv.Optional("room_humidity"): cv.returning_lambda,
            cv.Optional("mode_select"): cv.use_id(select.Select),
            cv.Optional("zone_status"): cv.returning_lambda,
            cv.Optional("dhw_request"): cv.returning_lambda,
            cv.Optional("levels"): cv.Schema({cv.Required(k): cv.use_id(number.Number) for k in LEVELS}),
        }
    )
    .extend(cv.polling_component_schema("2s")),
    _check,
)


async def to_code(config):
    var = await climate.new_climate(config)
    await cg.register_component(var, config)
    cg.add(var.set_kind(config["kind"]))
    cg.add(var.set_target_number(await cg.get_variable(config["target"])))
    if "mode_select" in config:
        cg.add(var.set_mode_select(await cg.get_variable(config["mode_select"])))
    for key, setter, rtype in (
        ("operating_mode", var.set_operating_mode, cg.int_),
        ("room_temperature", var.set_room_temperature, cg.float_),
        ("room_humidity", var.set_room_humidity, cg.float_),
        ("zone_status", var.set_zone_status, cg.int_),
        ("dhw_request", var.set_dhw_request, cg.bool_),
    ):
        if key in config:
            cg.add(setter(await cg.process_lambda(config[key], [], return_type=rtype)))
    if "levels" in config:
        nums = [await cg.get_variable(config["levels"][k]) for k in LEVELS]
        cg.add(var.set_levels(*nums))
