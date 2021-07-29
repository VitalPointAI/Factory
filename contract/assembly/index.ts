import { ContractPromiseBatch, PersistentVector, PersistentMap, Context, u128, env } from 'near-sdk-as'

const CODE = includeBytes('./daowasm/catalystdao.wasm')

@nearBindgen
export class daoModel {
  contractId: string;
  created: u64;
  summoner: string;

  constructor (
    contractId: string,
    created: u64,
    summoner: string
  )
  {
    this.contractId = contractId;
    this.created = created;
    this.summoner = summoner;
  }
}

let daos = new PersistentVector<daoModel>('dM')
let daoIndex = new PersistentMap<string, i32>('dI')

export function getDaoList(start: i32, end: i32): Array<daoModel> {
  let newList = new Array<daoModel>()
  for(let i: i32 = start; i < end; i++) {
    if (env.isValidAccountID(daos[i].contractId)) {
      newList.push(daos[i])
    }
  }
  return newList
}

export function getDaoListLength(): i32 {
  return daos.length
}

export function getDaoIndex(accountId: string): i32 {
  let index = daoIndex.getSome(accountId)
  if (index) {
    return index
  } else {
  return -1
  }
}

export function deleteDAO(accountId: string, beneficiary: string): ContractPromiseBatch {
  assert(env.isValidAccountID(accountId), 'not a valid account')
  assert(env.isValidAccountID(beneficiary), 'not a valid beneficiary account')

  // get DAO's index, ensuring it is in the daos vector
  let index = getDaoIndex(accountId)
  assert(index != -1, 'dao does not exist - can not delete')

  // replace the DAO in the vector so we can maintain order to facilitate the ability to find and delete a DAO at a specific index
  // replace the DAO with the placeholder DAO and then delete it from the index
  let placeholderDao = new daoModel(accountId+':X', Context.blockTimestamp, Context.predecessor)
  daos.replace(index, placeholderDao)
  daoIndex.delete(accountId)
  
  // if we make it here, the DAO is effectively removed from our tracking mechanisms, so the account can be deleted with 
  // anything left in it going to the beneficiary address
  let promise = ContractPromiseBatch.create(accountId)
  .delete_account(beneficiary)
  
  return promise
}

export function createDAO(
  accountId: string,
  deposit: u128
): ContractPromiseBatch {
  assert(Context.attachedDeposit >= deposit, 'not enough deposit was attached')
  assert(env.isValidAccountID(accountId), 'not a valid near account')
 
  let promise = ContractPromiseBatch.create(accountId)
    .create_account()
    .deploy_contract(Uint8Array.wrap(changetype<ArrayBuffer>(CODE)))
    .transfer(Context.attachedDeposit)
  
  // next index (location to store the new DAO) should always be equal to the current length of the daos vector
  let nextIndex = getDaoListLength()
  daoIndex.set(accountId, nextIndex) 

  let newDaoModel = new daoModel(accountId, Context.blockTimestamp, Context.predecessor)
  daos.push(newDaoModel)

  return promise
}