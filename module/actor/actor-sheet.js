/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
import {isCompatibleContainer} from "../inventory/inventory.js";

export class TorchbearerActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["torchbearer", "sheet", "actor"],
      template: "systems/torchbearer/templates/actor/actor-sheet.html",
      width: 617,
      height: 848,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      dragDrop: [{dragSelector: ".items-list .item", dropSelector: null}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();

    // Condition checkboxes
    const conditionStates = [data.data.hungryandthirsty, data.data.angry, data.data.afraid, data.data.exhausted, data.data.injured, data.data.sick, data.data.dead];
    const inc = (100 / 7);
    let conditionsTrue = 0;
    conditionStates.forEach(element => {
      if (element === true) {
        conditionsTrue++;
      }
    });
    data.data.conditionProgress = Math.round(conditionsTrue * inc);

    // Update checks
    let trait1Checks = parseInt(data.data.traits.trait1.checks.checksEarned);
    let trait2Checks = parseInt(data.data.traits.trait2.checks.checksEarned);
    let trait3Checks = parseInt(data.data.traits.trait3.checks.checksEarned);
    let trait4Checks = parseInt(data.data.traits.trait4.checks.checksEarned);
    data.data.totalChecks.value = trait1Checks + trait2Checks + trait3Checks + trait4Checks;

    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    this.html = html;

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Inventory Item
    //html.find('.item-create').click(this._onItemCreate.bind(this));

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.getOwnedItem(li.data("itemId"));
      // const equip = item.data.data.equip;
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");

      this.actor.removeItemFromInventory(li.data("itemId")).then(() => {
        // Get the equipment slot of the item being deleted
        li.slideUp(200, () => this.render(false));
      });
    });

    // Rollable abilities
    html.find('.rollable').click(this._onRoll.bind(this));

    // Class changes
    // html.find('#classDropdown').change(ev => {
    //   let className = ev.currentTarget.selectedOptions[0].value;
    //   const classPack = game.packs.get("torchbearer.classes");
    //   let entry;
    //   classPack.getIndex().then(index => classPack.index.find(e => e.name === className)).then(f => {
    //     entry = f;
    //     classPack.getEntity(entry._id).then(cl => {
    //       console.log(cl);
    //       // I can access compendium classes from here.
    //     });
    //   });
    // });

  }

  /* -------------------------------------------- */
  
  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemCreate(event) {
    event.preventDefault();
    
    const header = event.currentTarget;

    // Get the type of item to create.
    const type = header.dataset.type;
    
    // Grab any data associated with this control.
    const equipSlot = header.type;
    const data = duplicate(header.dataset);
    data.equip = equipSlot;

    // Initialize a default name.
    const name = `New ${type.capitalize()}`;

    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      data: data,
    };

    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    // Finally, create the item!
    return this.actor.createOwnedItem(itemData);
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    
    // Determine attribute/skill to roll
    let rollTarget = dataset.label;

    // Determine if rollTarget is a skill
    let skill = this.isSkill(rollTarget);

    // Determine if double-tapping Nature is an option
    let doubleTap = false;
    if (skill.rating === 0) {
      doubleTap = true;
    }

    // Capitalize first letter for later use in the roll template
    let header = 'Testing: ' + rollTarget.charAt(0).toUpperCase() + rollTarget.slice(1);

    let freshCheck = "";
    if (this.actor.data.data.fresh === true) {
      freshCheck = "checked";
    }

    // Dialog box for roll customization
    let dialogContent = 'systems/torchbearer/templates/roll-dialog-content.html';
    
    // Build an actor trait list to be passed to the dialog box
    let traits = [];
    const traitList = this.actor.data.data.traits;
    Object.keys(traitList).forEach(key => {
      if (traitList[key].name != "") {
        traits.push(traitList[key].name);
      }
    });

    renderTemplate(dialogContent, {attribute: header, traitList: traits, fresh: freshCheck, natureDoubleTap: doubleTap}).then(template => {
      new Dialog({
        title: `Test`,
        content: template,
        buttons: {
          yes: {
            icon: "<i class='fas fa-check'></i>",
            label: `Roll`,
            callback: (html) => {
              let flavor = html.find('#flavorText')[0].value;
              let help = html.find('#helpingDice')[0].value;
              let ob = html.find('#ob')[0].value;
              let nature = html.find('#natureYes')[0].checked;
              let supplies = html.find('#supplies')[0].value;
              let persona = html.find('#personaAdvantage')[0].value;
              let trait = {
                name: html.find('#traitDropdown')[0].value,
                usedFor: html.find('#traitFor')[0].checked,
                usedAgainst: html.find('#traitAgainst')[0].checked,
                usedAgainstExtra: html.find('#traitAgainstExtra')[0].checked
              };
              this.tbRoll(rollTarget, flavor, header, help, ob, trait, nature, freshCheck, supplies, persona);
            }
          },
          no: {
            icon: "<i class='fas fa-times'></i>",
            label: `Cancel`
          }
        },
        default: 'yes'
      }).render(true);
    });
  }

  isSkill(rollTarget) {
    // Create an array of skills for the if check below
    let skills = [];
    const skillList = this.actor.data.data.skills;
    Object.keys(skillList).forEach(key => {
      skills.push(skillList[key].name);
    });

    let skillInfo = {
      "name": "",
      "rating": 0,
      "blAbility": ""
    };

    skills.forEach(key => {
      if (rollTarget === key) {
        skillInfo.name = rollTarget;
        skillInfo.rating = this.actor.data.data.skills[rollTarget].rating;
        skillInfo.blAbility = this.actor.data.data.skills[rollTarget].bl;
      }
    });

    if (skillInfo.name === "") {
      return false;
    } else {
      return skillInfo;
    }
  }

  whichTrait(trait) {
    let temp = '';
    let traitFinder = this.actor.data.data.traits;
    Object.keys(traitFinder).forEach((key, index) => {
      if (trait.name === traitFinder[key].name) {
        temp = `trait${index+1}`;
      }
    });
    return temp;
  }

  tbRoll(rollTarget, flavor, header, help, ob, trait, nature, freshCheck, supplies, persona) {
    
    // Check to see if the Fresh bonus should be applied
    let freshMod = 0;
    if (freshCheck === "checked") {
      freshMod = 1;
    }
    
    // Set supplies to zero if it's NaN
    let suppliesMod;
    if (isNaN(parseInt(supplies))) {
      suppliesMod = 0;
    } else {
      suppliesMod = parseInt(supplies);
    }

    // Set help to zero if it's NaN
    let helpMod;
    if (isNaN(parseInt(help))) {
      helpMod = 0;
    } else {
      helpMod = parseInt(help);
    }

    // Determine if and how a Trait is being used
    let traitMod = 0;
    if (trait.name != "") {
      if (trait.usedFor === true) {
        // Make sure the Trait is able to be used beneficially
        let traitFinder = this.actor.data.data.traits;
        Object.keys(traitFinder).forEach((key, index) => {
          if (trait.name === traitFinder[key].name) {
            if (traitFinder[key].level.value === "1") {
              // Return if the trait has already been used this session, else check it off
              if (traitFinder[key].uses.level1.use1 === true) {
                ui.notifications.error(`ERROR: You've already used ${trait.name} this session.`);
                return;
              } else {
                let temp = `trait${index+1}`;
                switch (temp) {
                  case 'trait1':
                    traitMod = 1;
                    this.actor.update({'data.traits.trait1.uses.level1.use1': true});
                    break;
                  case 'trait2':
                    traitMod = 1;
                    this.actor.update({'data.traits.trait2.uses.level1.use1': true});
                    break;
                  case 'trait3':
                    traitMod = 1;
                    this.actor.update({'data.traits.trait3.uses.level1.use1': true});
                    break;
                  case 'trait4':
                  traitMod = 1;
                  this.actor.update({'data.traits.trait4.uses.level1.use1': true});
                  break;
                }
              }
            } else if (traitFinder[key].level.value === "2") {
              if (traitFinder[key].uses.level1.use1 === true && traitFinder[key].uses.level2.use2 === true) {
                ui.notifications.error(`ERROR: You've already used ${trait.name} this session.`);
                return;
              } else if (traitFinder[key].uses.level1.use1 === false) {
                let temp = `trait${index+1}`;
                switch (temp) {
                  case 'trait1':
                    traitMod = 1;
                    this.actor.update({'data.traits.trait1.uses.level1.use1': true});
                    break;
                  case 'trait2':
                    traitMod = 1;
                    this.actor.update({'data.traits.trait2.uses.level1.use1': true});
                    break;
                  case 'trait3':
                    traitMod = 1;
                    this.actor.update({'data.traits.trait3.uses.level1.use1': true});
                    break;
                  case 'trait4':
                  traitMod = 1;
                  this.actor.update({'data.traits.trait4.uses.level1.use1': true});
                  break;
                }
              } else if (traitFinder[key].uses.level2.use2 === false) {
                let temp = `trait${index+1}`;
                switch (temp) {
                  case 'trait1':
                    traitMod = 1;
                    this.actor.update({'data.traits.trait1.uses.level2.use2': true});
                    break;
                  case 'trait2':
                    traitMod = 1;
                    this.actor.update({'data.traits.trait2.uses.level2.use2': true});
                    break;
                  case 'trait3':
                    traitMod = 1;
                    this.actor.update({'data.traits.trait3.uses.level2.use2': true});
                    break;
                  case 'trait4':
                  traitMod = 1;
                  this.actor.update({'data.traits.trait4.uses.level2.use2': true});
                  break;
                }
              }
            }
          } 
        });
      } else if (trait.usedAgainst === true) {
        traitMod = -1;
        // Add checks to the actor sheet
        let traitNum = this.whichTrait(trait);
        switch(traitNum) {
          case 'trait1':
            this.actor.update({'data.traits.trait1.checks.checksEarned': parseInt(this.actor.data.data.traits.trait1.checks.checksEarned + 1)});
            break;
          case 'trait2':
            this.actor.update({'data.traits.trait2.checks.checksEarned': parseInt(this.actor.data.data.traits.trait3.checks.checksEarned + 1)});
            break;
          case 'trait3':
            this.actor.update({'data.traits.trait3.checks.checksEarned': parseInt(this.actor.data.data.traits.trait3.checks.checksEarned + 1)});
            break;
          case 'trait4':
            this.actor.update({'data.traits.trait4.checks.checksEarned': parseInt(this.actor.data.data.traits.trait4.checks.checksEarned + 1)});
            break;
        }
      } else if (trait.usedAgainstExtra === true) {
        traitMod = -2;
        // Add a check to the actor sheet
        let traitNum = this.whichTrait(trait);
        switch(traitNum) {
          case 'trait1':
            this.actor.update({'data.traits.trait1.checks.checksEarned': parseInt(this.actor.data.data.traits.trait1.checks.checksEarned + 2)});
            break;
          case 'trait2':
            this.actor.update({'data.traits.trait2.checks.checksEarned': parseInt(this.actor.data.data.traits.trait3.checks.checksEarned + 2)});
            break;
          case 'trait3':
            this.actor.update({'data.traits.trait3.checks.checksEarned': parseInt(this.actor.data.data.traits.trait3.checks.checksEarned + 2)});
            break;
          case 'trait4':
            this.actor.update({'data.traits.trait4.checks.checksEarned': parseInt(this.actor.data.data.traits.trait4.checks.checksEarned + 2)});
            break;
        }
      }
    }

    // Check to see if persona points are spent to add +XD
    let personaMod = 0;
    if (persona != "" && this.actor.data.data.persona.value >= parseInt(persona)) {
      personaMod = parseInt(persona);
      this.actor.update({'data.persona.value': this.actor.data.data.persona.value - personaMod});
      this.actor.update({'data.persona.spent': this.actor.data.data.persona.spent + personaMod});
    } else if (persona != "" && this.actor.data.data.persona.value < parseInt(persona)) {
      ui.notifications.error("ERROR: You don't have enough persona to spend.");
      return;
    }

    // Determine if Nature has been tapped. If so, add Nature to roll and deduce 1 persona point.
    let natureMod = 0;
    if (nature === true && this.actor.data.data.persona.value < 1) {
      ui.notifications.error("ERROR: You don't have any persona to spend.");
      return;
    } else if (nature === true && this.actor.data.data.persona.value >= 1) {
      natureMod = this.actor.data.data.nature.value;
      this.actor.update({'data.persona.value': this.actor.data.data.persona.value - 1});
      this.actor.update({'data.persona.spent': this.actor.data.data.persona.spent + 1});
    }
    
    // Create an array of skills for the if check below
    let skills = [];
    const skillList = this.actor.data.data.skills;
    Object.keys(skillList).forEach(key => {
      skills.push(skillList[key].name);
    });

    // Determine number of dice to roll. 
    let diceToRoll;
    let beginnersLuck = "";
    
    // Is the thing being rolled a skill?
    skills.forEach(key => {
      if (rollTarget === key) {
        // Check for Beginner's Luck
        if (this.actor.data.data.skills[rollTarget].rating === 0) {
          let blAbility = this.actor.data.data.skills[rollTarget].bl;
          if (blAbility === "W") {
            // If Will is not zero, roll Beginner's Luck as normal
            if (this.actor.data.data.will.value != 0) {
              beginnersLuck = "(Beginner's Luck, Will)";
              diceToRoll = Math.ceil((this.actor.data.data.will.value + suppliesMod + helpMod)/2) + traitMod + natureMod + freshMod + personaMod;
            } else if (this.actor.data.data.will.value === 0) {
              // If Will is zero, use Nature instead
              beginnersLuck = "(Beginner's Luck, Nature)";
              diceToRoll = Math.ceil((this.actor.data.data.nature.value + suppliesMod + helpMod)/2) + traitMod + natureMod + freshMod + personaMod;
            }
          } else if (blAbility === "H") {
            // If Health is not zero, roll Beginner's Luck as normal
            if (this.actor.data.data.health.value != 0) {
              beginnersLuck = "(Beginner's Luck, Health)";
              diceToRoll = Math.ceil((this.actor.data.data.health.value + suppliesMod + helpMod)/2) + traitMod + natureMod + freshMod + personaMod;
            } else if (this.actor.data.data.will.value === 0) {
              // If Health is zero, use Nature instead
              beginnersLuck = "(Beginner's Luck, Nature)";
              diceToRoll = Math.ceil((this.actor.data.data.nature.value + suppliesMod + helpMod)/2) + traitMod + natureMod + freshMod + personaMod;
            }
          }
        } else {
          diceToRoll = this.actor.data.data.skills[rollTarget].rating + traitMod + natureMod + freshMod + suppliesMod + helpMod + personaMod;
        }
      }
    });

    // Otherwise it's an ability
    if (diceToRoll === undefined) {
      diceToRoll = this.actor.data.data[rollTarget].value + traitMod + natureMod + freshMod + suppliesMod + helpMod + personaMod;
    }

    // Build the formula
    let formula = `${diceToRoll}d6`;

    // Prep the roll template
    let template = 'systems/torchbearer/templates/torchbearer-roll.html';

    // GM rolls
    let chatData = {
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    };
    let templateData = {
      title: header,
      flavorText: flavor,
      rollDetails: `${diceToRoll}D vs. Ob ${ob}`,
      bL: beginnersLuck,
      roll: {}
    };

    // Handle roll visibility. Blind doesn't work; you'll need a render hook to hide it.
    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user._id];
    if (rollMode === "blindroll") chatData["blind"] = true;

    // Do the roll
    let roll = new Roll(formula);
    roll.roll();

    //Create an array of the roll results
    let rollResult = [];
    roll.parts[0].rolls.forEach(key => {
      if (key.roll === 6) {
        rollResult.push({
          result: key.roll,
          style: 'max'
        });
      } else {
        rollResult.push({
          result: key.roll,
        });
      }
    });

    // Count successes
    let rolledSuccesses = 0;
    let displaySuccesses;
    rollResult.forEach((index) => {
      if (index.result > 3) {
        rolledSuccesses++;
      }
    });
    if (rolledSuccesses === 1) {
      displaySuccesses = `${rolledSuccesses} Success`;
    } else {
      displaySuccesses = `${rolledSuccesses} Successes`;
    }

    let passFail = ' - Fail!';
    if (rolledSuccesses >= ob) {
      passFail = ' - Pass!'
    }

    renderTemplate('systems/torchbearer/templates/roll-template.html', {title: header, results: rollResult, dice: diceToRoll, success: displaySuccesses, flavorText: flavor, outcome: passFail}).then(t => {
      // Add the dice roll to the template
      templateData.roll = t,
      chatData.roll = JSON.stringify(roll);

      // Render the roll template
      renderTemplate(template, templateData).then(content => {
        
        // Update the message content
        chatData.content = content;

        // Hook into Dice So Nice!
        if (game.dice3d) {
          game.dice3d.showForRoll(roll, chatData.whisper, chatData.blind).then(displayed => {
            ChatMessage.create(chatData)
          });
        }
        // Roll normally, add a dice sound
        else {
          chatData.sound = CONFIG.sounds.dice;
          ChatMessage.create(chatData);
        }
      });
    });
  }

  closestCompatibleContainer(item, target) {
    let $closestContainer = $(target).closest('.inventory-container');
    if(!$closestContainer.length) {
      return {};
    }
    const containerType = $closestContainer.data('containerType');
    const containerId = $closestContainer.data('itemId');
    if(isCompatibleContainer(item, containerType)) {
      return {
        containerType,
        containerId: containerId || '',
      };
    } else {
      return this.closestCompatibleContainer(item, $closestContainer.parent());
    }
  }

  /** @override */
  async _onDrop(event) {
    let item = await super._onDrop(event);
    if(item._id) {
      item = this.actor.items.get(item._id);
    }
    if(item.data) {
      let oldContainerId = item.data.data.containerId;
      let {containerType, containerId} = this.closestCompatibleContainer(item, event.target);
      if(containerType) {
        await item.update({data: {equip: containerType, containerId: containerId}});
        this.actor._onUpdate({items: true});
        if(oldContainerId) {
          let oldContainer = this.actor.items.get(oldContainerId);
          setTimeout(() => {
            oldContainer.sheet.render(false);
          }, 0)
        }
      }
    }
    return item;
  }

  /** @override */
  _onSortItem(event, itemData) {
    super._onSortItem(event, itemData);
    let item = this.actor.items.get(itemData._id);
    return item.data;
  }
}
