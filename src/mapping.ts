import { Changed } from '../generated/LinageeLegacy/LinageeLegacy'
import { Transfer, Wrapped, Unwrapped } from '../generated/LinageeWrapped/LinageeWrapper'
import { Holder, LinageeLog, LinageeName, LinageeNameWrapped, Stats } from '../generated/schema'

import { Address, Bytes, ethereum, store } from '@graphprotocol/graph-ts'

const NULL_ADDR = '0x0000000000000000000000000000000000000000';
const ERLW_ADDR = '0x2cc8342d7c8bff5a213eb2cde39de9a59b3461a7';
const TOOLS_V1_ADDR = '0x72C30B3e3B1526A24b757F5dC1DC1F4A6A8D4EdB';

// Linagee contract Changed() event handler
export function handleChanged(event: Changed): void {
   let stats = Stats.load('1');

   if (!stats) {
      stats = new Stats('1');
      stats.activeRegisters = 0;
      stats.registers = 0;
      stats.transfers = 0;
      stats.wraps = 0;
      stats.save();
   }

   let methodID = event.transaction.input.toHexString().substring(0, 10);

   if (methodID == '0x432ced04' || methodID == '0x62a52fff') {
      // Reserve
      let name = LinageeName.load('name-' + event.params.name.toHexString());

      if (!name) {
         name = new LinageeName('name-' + event.params.name.toHexString());
         name.name = event.params.name.toString() ? event.params.name.toString() : '';
         name.registerIndex = stats.registers + 1;
         name.logsIndex = 0;
      }

      name.owner = event.transaction.from;
      name.subRegistrar = Address.fromString(NULL_ADDR);
      name.registered = true;
      name.wrapped = false;
      name.wrappedOwner = Address.fromString(NULL_ADDR);
      name.save();

      if ((methodID == '0x62a52fff' && event.block.number.toI32() < 15750523) || event.transaction.hash == Bytes.fromHexString('0xdbd52bef498a64bb2dec6f4650fd88774b679a3d3e5e76394a017b3f836c8f9c')) {
         name.owner = Address.fromString(TOOLS_V1_ADDR);
         name.save();
      }

      stats.activeRegisters = stats.activeRegisters + 1;
      stats.registers = stats.registers + 1;
      stats.save();

      manageHolder(name.owner.toHexString(), 1, 'LEGACY', event.block, 'Reserve');
      createLog('REGISTER', name.id, event.transaction, event.block);
   } else if (methodID == '0x79ce9fac') {
      // Transfer
      let newOwner = '0x' + event.transaction.input.toHexString().substring(event.transaction.input.toHexString().length - 40, event.transaction.input.toHexString().length);
      let name = LinageeName.load('name-' + event.params.name.toHexString());
      if (name != null) {

         manageHolder(name.owner.toHexString(), -1, 'LEGACY', event.block, 'TransferLegacyFrom');
         manageHolder(newOwner, 1, 'LEGACY', event.block, 'TransferLegacyTo');

         name.owner = Address.fromString(newOwner);
         name.save();

         stats.transfers = stats.transfers + 1;
         stats.save();

         createLog('TRANSFER', name.id, event.transaction, event.block);
      }
   } else if (methodID == '0x89a69c0e') {
      // setSubRegistrar
      let subRegistrar = '0x' + event.transaction.input.toHexString().substring(event.transaction.input.toHexString().length - 40, event.transaction.input.toHexString().length);
      let name = LinageeName.load('name-' + event.params.name.toHexString());
      if (name != null) {
         name.subRegistrar = Address.fromString(subRegistrar);
         name.save();

         createLog('SET_SUB_REGISTRAR', name.id, event.transaction, event.block);
      }
   } else if (methodID == '0xd93e573') {
      // Disown
      let name = LinageeName.load('name-' + event.params.name.toHexString());
      if (name != null) {
         manageHolder(name.owner.toHexString(), -1, 'LEGACY', event.block, 'Disown');

         name.owner = Address.fromString(NULL_ADDR);
         name.subRegistrar = Address.fromString(NULL_ADDR);
         name.registered = false;
         name.wrapped = false;
         name.save();

         stats.activeRegisters = stats.activeRegisters - 1;
         stats.save();

         createLog('DISOWN', name.id, event.transaction, event.block);
      }
   } else if (methodID == '0x71ec7785' || methodID == '0xf3461a7b' || methodID == '0xa4c6bc7b') {
      // Linagee.tools methods
      let name = LinageeName.load('name-' + event.params.name.toHexString());

      if (name != null) {
         manageHolder(name.owner.toHexString(), -1, 'LEGACY', event.block, 'Custom1-');
         manageHolder(ERLW_ADDR, 1, 'LEGACY', event.block, 'Custom1+');

         name.owner = Address.fromString(ERLW_ADDR);
         name.save();

         stats.transfers = stats.transfers + 1;
         stats.save();

         createLog('TRANSFER', name.id, event.transaction, event.block);
      } else {
         name = new LinageeName('name-' + event.params.name.toHexString());
         name.name = event.params.name.toString() ? event.params.name.toString() : '';
         name.registerIndex = stats.registers + 1;
         name.logsIndex = 0;
         name.owner = event.transaction.from;
         name.subRegistrar = Address.fromString(NULL_ADDR);
         name.registered = true;
         name.wrapped = false;
         name.wrappedOwner = Address.fromString(NULL_ADDR);
         name.save();

         stats.activeRegisters = stats.activeRegisters + 1;
         stats.registers = stats.registers + 1;
         stats.save();

         manageHolder(name.owner.toHexString(), 1, 'LEGACY', event.block, 'Custom2');
         createLog('REGISTER', name.id, event.transaction, event.block);
      }
   }
}


// ERC-721 wrapper transfer event handler
export function handleTransfer(event: Transfer): void {
   let nameWrapped = LinageeNameWrapped.load(event.params.tokenId.toString());

   if (nameWrapped != null && nameWrapped.linageeName != null) {
      nameWrapped.owner = event.params.to;
      nameWrapped.save();

      let nameLegacy = LinageeName.load(nameWrapped.linageeName as string);
      if (nameLegacy != null) {
         nameLegacy.wrappedOwner = event.params.to;
         nameLegacy.save();

         manageHolder(event.params.from.toHexString(), -1, 'WRAPPED', event.block, 'handleTransferFrom');
         manageHolder(event.params.to.toHexString(), 1, 'WRAPPED', event.block, 'handleTransferTo');
         createLog('WRAPPER_TRANSFERED', nameLegacy.id, event.transaction, event.block);
      }
   }
}


// ERC-721 wrapper unwrapped event handler
export function handleUnwrapped(event: Unwrapped): void {
   let name = LinageeName.load('name-' + event.params.namer.toHexString());

   if (name != null) {
      if (name.linageeNameWrapped) {
         store.remove('LinageeNameWrapped', (name.linageeNameWrapped as string))
      }

      manageHolder(name.wrappedOwner.toHexString(), -1, 'WRAPPED', event.block, 'handleUnwrapped');

      name.wrappedOwner = Address.fromString(NULL_ADDR);
      name.wrapped = false;
      name.save();

      createLog('UNWRAPPED', name.id, event.transaction, event.block);
   }
}

// ERC-721 wrapper wrapped event handler
export function handleWrapped(event: Wrapped): void {
   let stats = Stats.load('1');

   let name = LinageeName.load('name-' + event.params.namer.toHexString());

   if (name != null && stats != null) {
      let nameWrapped = new LinageeNameWrapped(event.params.pairId.toString());
      nameWrapped.owner = event.params.owner;
      nameWrapped.linageeName = name.id;
      nameWrapped.save();

      name.wrapped = true;
      name.wrappedOwner = event.params.owner;
      name.linageeNameWrapped = nameWrapped.id;
      name.save();

      if (stats != null) {
         stats.wraps = stats.wraps + 1;
         stats.save();
      }

      manageHolder(name.wrappedOwner.toHexString(), 1, 'WRAPPED', event.block, 'handleWrapped');
      createLog('WRAPPED', name.id, event.transaction, event.block);
   }
}


function manageHolder(address: string, amount: number, type: string, block: ethereum.Block, test: string): void {
   let holder = Holder.load(address);

   if (!holder) {
      holder = new Holder(address);
      holder.firstTime = block.number;
      holder.totalNames = 0;
      holder.legacyNames = 0;
      holder.wrappedNames = 0;
   }

   if (type === 'LEGACY') {
      holder.totalNames += amount as i32
      holder.legacyNames += amount as i32
   } else if (type === 'WRAPPED') {
      holder.totalNames += amount as i32
      holder.wrappedNames += amount as i32
   }

   holder.save();
}


function createLog(type: string, name: string, transaction: ethereum.Transaction, block: ethereum.Block): void {
   let linageeName = LinageeName.load(name);

   if (linageeName != null) {
      let log = new LinageeLog(linageeName.registerIndex.toString() + '-' + linageeName.logsIndex.toString());
      log.type = type;
      log.data = transaction.input.toHexString();
      log.txHash = transaction.hash.toHexString();
      log.block = block.number;
      log.linageeName = linageeName.id;
      log.save();

      linageeName.logsIndex = linageeName.logsIndex + 1;
      linageeName.save();
   }

}


// getCategories function, unused for now
// function getCategories(name: string): string[] {
//    const categories: string[] = []
//    const nameLength: number = name.length;
 
//    // DIGITS
//    if (nameLength <= 6) {
//      if (nameLength == 6 && new RegExp('[0-9]{6}').exec(name) != null) {
//        categories.push("6D")
//      } else if (nameLength == 5 && new RegExp('[0-9]{5}').exec(name) != null) {
//        categories.push("5D")
//      } else if (nameLength == 4 && new RegExp('[0-9]{4}').exec(name) != null) {
//        categories.push("4D")
//      } else if (nameLength == 3 && new RegExp('[0-9]{3}').exec(name) != null) {
//        categories.push("3D")
//      } else if (nameLength == 2 && new RegExp('[0-9]{2}').exec(name) != null) {
//        categories.push("2D")
//      } else if (nameLength == 1 && new RegExp('[0-9]').exec(name) != null) {
//        categories.push("1D")
//      }
//    }
 
//    // LOWERCASE LETTERS
//    if (nameLength <= 5 && categories.length == 0) {
//      if (nameLength == 5 && new RegExp('[a-z]{5}').exec(name) != null) {
//        categories.push("5LCL")
//      } else if (nameLength == 4 && new RegExp('[a-z]{4}').exec(name) != null) {
//        categories.push("4LCL")
//      } else if (nameLength == 3 && new RegExp('[a-z]{3}').exec(name) != null) {
//        categories.push("3LCL")
//      } else if (nameLength == 2 && new RegExp('[a-z]{2}').exec(name) != null) {
//        categories.push("2LCL")
//      } else if (nameLength == 1 && new RegExp('[a-z]').exec(name) != null) {
//        categories.push("1LCL")
//      }
//    }
 
//    // UPPERCASE LETTERS
//    if (nameLength <= 5 && categories.length == 0) {
//      if (nameLength == 5 && new RegExp('[A-Z]{5}').exec(name) != null) {
//        categories.push("5UCL")
//      } else if (nameLength == 4 && new RegExp('[A-Z]{4}').exec(name) != null) {
//        categories.push("4UCL")
//      } else if (nameLength == 3 && new RegExp('[A-Z]{3}').exec(name) != null) {
//        categories.push("3UCL")
//      } else if (nameLength == 2 && new RegExp('[A-Z]{2}').exec(name) != null) {
//        categories.push("2UCL")
//      } else if (nameLength == 1 && new RegExp('[A-Z]').exec(name) != null) {
//        categories.push("1UCL")
//      }
//    }
 
//    return categories
//  }