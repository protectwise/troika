import { utils } from 'troika-core'
const { assign } = utils

export default class CollisionEvent {
  constructor (eventType, target, collisionTarget, contacts, extraProps) {
    this.target = target
    this.collisionTarget = collisionTarget
    this.collisionContacts = contacts
    this.type = eventType
    assign(this, extraProps)
  }
}
