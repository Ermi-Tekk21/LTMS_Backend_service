import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";

@EventSubscriber()
export class LowercaseSubscriber implements EntitySubscriberInterface<Record<string, any>> {
  beforeInsert(event: InsertEvent<Record<string, any>>) {
    if (event.entity) this.toLowercaseAllStrings(event.entity);
  }

  beforeUpdate(event: UpdateEvent<Record<string, any>>) {
    if (event.entity) this.toLowercaseAllStrings(event.entity);
  }

  private toLowercaseAllStrings(entity: Record<string, any>) {
    const entityName = entity?.constructor?.name ?? 'Object';
    const keys = Object.keys(entity);
    const stringKeys = keys.filter(k => typeof entity[k] === 'string');
    const shown = stringKeys.slice(0, 10).join(', ') + (stringKeys.length > 10 ? ', ...' : '');
    console.log(
      `[LowercaseSubscriber] Processing entity=${entityName} keys=${keys.length} stringKeys=${stringKeys.length}` +
      (stringKeys.length ? ` fields=[${shown}]` : '')
    );
    
    for (const key of Object.keys(entity)) {
      const value = entity[key];
      if (typeof value === 'string') {
        entity[key] = value.toLowerCase();
      }
    }
  }
}
