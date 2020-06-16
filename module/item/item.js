import {cloneInventory, newItemInventory} from "../inventory/inventory.js";
import {itemExtensions} from "./itemExtensions.js";

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class TorchbearerItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    super.prepareData();
    // Get the Item's data
    const itemData = this.data;
    const actorData = this.actor ? this.actor.data : {};
    const data = itemData.data;

    data.computed = data.computed || {};
    data.computed.consumedSlots = itemData.data.slots;
    let itemExtension = itemExtensions[this.data.name];
    if(itemExtension) {
      for(const functionName in itemExtension) {
        if(itemExtension.hasOwnProperty(functionName)) {
          this[functionName] = itemExtension[functionName].bind(this);
        }
      }
    }
  }

  tbData() {
    return this.data.data;
  }
  
  async syncEquipVariables() {
    let tbData = this.tbData();
    for(let i = 1; i <= 3; i++) {
      if(tbData.equip === tbData.equipOptions['option' + i].value) {
        await this.update({
          data: {
            carried: tbData.carryOptions['option' + i].value,
            slots: tbData.slotOptions['option' + i].value,
          }
        });
        return;
      }
    }
  }

  async consumeOne() {
    if(!this.actor) {
      return;
    }

    if(!this.onBeforeConsumed()) {
      return;
    }

    let update;
    const tbData = this.tbData();
    if(tbData.consumable.consumes === 'draughts') {
      update = this.update({
        data: {
          draughts: Math.clamped(tbData.draughts - 1, 0, 10),
        }
      });
    } else if(tbData.consumable.consumes === 'self') {
      update = this.actor.removeItemFromInventory(this.data._id);
    } else if(tbData.consumable.consumes === 'light') {
      update = this.update({
        data: {
          lightsource: {
            remaining: Math.clamped(tbData.lightsource.remaining - 1, 0, 10),
          }
        }
      });
    }
    await update;
    await this.onAfterConsumed();
  }

  async toggleActive() {
    if(!this.actor) return;
    const tbData = this.tbData();
    if(!tbData.activatable.activates) return;
    if(!this.onBeforeActivate()) return;
    await this.update({
      data: {
        activatable: {
          active: !tbData.activatable.active,
        }
      }
    });
  }

  isCompatibleContainer(containerType) {
    return this.validContainerTypes().includes(containerType);
  }

  validContainerTypes() {
    return [
      this.data.data.equipOptions.option1.value,
      this.data.data.equipOptions.option2.value,
      this.data.data.equipOptions.option3.value,
    ];
  }

  slotsTaken(containerType) {
    for(let i = 1; i <= 3; i++) {
      if(this.data.data.equipOptions['option' + i].value === containerType) {
        return this.data.data.slotOptions['option' + i].value;
      }
    }
    throw("Invalid slots");
  }

  /**
   * Overridable Callback action
   * @param tbItemOther: the other object
   * @param given: array of items that have already been confirmed
   * @return true if ok to add, false if not and make this object unbundleable
   */
  onBeforeBundleWith(tbItemOther, given) {
    return true;
  }
  /**
   * Overridable Callback action
   * @param container: the inventory container being added to
   * @param given: array of items that have already been confirmed
   * @return true if ok to add, false if should be put on ground
   */
  onAfterAddToInventory(container, given) {
    return true;
  }

  /**
   * Overridable Callback actions whenever the item is consumed as
   * food or drink, etc.
   */
  onBeforeConsumed() {
    return true;
  }
  async onAfterConsumed() {
  }

  onBeforeActivate() {
    return true;
  }

  async onAfterEquipped(equippedEvent) {

  }

  /**
   * Overridable Callback action
   * @param container: the inventory container being added to
   * @param given: array of items that have already been confirmed
   * @return nothing but can modify data.data.computed.consumedSlots
   */
  onCalculateConsumedSlots(container, given) {
  }
}
