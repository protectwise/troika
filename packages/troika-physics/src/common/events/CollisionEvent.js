import { utils } from 'troika-core'
const { assign } = utils

export default class CollisionEvent {
  constructor (eventType, target, collisionTarget, contacts, extraProps) {
    this.target = target
    this.collisionTarget = collisionTarget
    // More ergonomic contact shapes
    this.collisionContacts = contacts && contacts.map(contact => {
      const [targetXYZ, sourceXYZ, normalXYZ, impulse, force] = contact

      return {
        // World-space position of contact on the receiving object (Object A)
        targetXYZ,
        // World-space position of contact on the colliding object (Object B)
        sourceXYZ,
        // World-space normal vector
        // The normal is pointing from Object B towards Object A. // https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=6620
        normalXYZ,
        impulse, // N•s
        force // N
      }
    })
    this.type = eventType
    assign(this, extraProps)
  }
}
