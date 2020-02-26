// More info on states https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=6221
const ACTIVATION_STATES = Object.freeze({
  ACTIVE_TAG: 1,
  ISLAND_SLEEPING: 2,
  WANTS_DEACTIVATION: 3, // Don't manually set this
  DISABLE_DEACTIVATION: 4,
  DISABLE_SIMULATION: 5
})

const COLLISION_FLAGS = Object.freeze({
  CF_STATIC_OBJECT: 1,
  CF_KINEMATIC_OBJECT: 2,
  CF_NO_CONTACT_RESPONSE: 4,
  CF_CUSTOM_MATERIAL_CALLBACK: 8,
  CF_CHARACTER_OBJECT: 16,
  CF_DISABLE_VISUALIZE_OBJECT: 32,
  CF_DISABLE_SPU_COLLISION_PROCESSING: 64,
  CF_HAS_CONTACT_STIFFNESS_DAMPING: 128,
  CF_HAS_CUSTOM_DEBUG_RENDERING_COLOR: 256,
  CF_HAS_FRICTION_ANCHOR: 512,
  CF_HAS_COLLISION_SOUND_TRIGGER: 1024
})

export default Object.freeze({
  DEFAULT_ACTIVATION_STATE: ACTIVATION_STATES.ACTIVE_TAG, // DISABLE_DEACTIVATION,
  ACTIVATION_STATES,
  COLLISION_FLAGS,
  // Map generic method names used by troika-physics to this physics engine
  METHODS_TO_AMMO: Object.freeze({
    Vector3: 'btVector3'
  })
})
