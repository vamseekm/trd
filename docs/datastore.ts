enum ItemTypes {
  pref = "pref",
  tick = "tick",
  candle = "candle",
}

interface IItemMeta {
  itemType: Item;
  itemName: string;
  itemTime: Date;
}

interface Item extends IItemMeta {}

function memoryStoreGet(key): any {
  return {};
}

function memoryStorePrevKey(key): any {
  // check the sorted set and return the previous key
  return "";
}

function sortedSetKeyScore(item: IItemMeta) {
  return {
    setName: item.itemName,
    score: item.itemTime.getTime(),
    value: item,
  };
}

function isAllowedToStoreInMemory(item: IItemMeta) {
  const { itemType, itemTime } = item;
  const map = new Map<Item, Date>();
  const configDate = map.get(itemType);
  return configDate != null && itemTime > configDate;
}

function memorySortedSetStore(item) {
  const { score, value, setName } = sortedSetKeyScore(item);
  //Store it in sorted set.
}

function memoryStoreSet(item: Item): any {
  const storeOnlyAfter = new Date();
  if (!isAllowedToStoreInMemory(item)) return false;
  memorySortedSetStore(item);
}

function persistStoreGet(key): any {
  return {};
}

function persistStoreSet(item: Item): any {
  //Store it in persistent store.
}
function persistStorePrevKey(key: string) {
  return "";
}

function get(key) {
  const memItem = memoryStoreGet(key);
  if (memItem) return memItem;
  const persisitItem = persistStoreGet(key);
  if (!persisitItem) return undefined;
  memoryStoreSet(persisitItem);
  return persisitItem;
}

function set(item: Item) {
  memoryStoreSet(item);
  persistStoreSet(item);
}

function getPrevKey(key) {
  let prevKey = memoryStorePrevKey(key);
  if (prevKey) return prevKey;
  prevKey = persistStorePrevKey(key);
  return prevKey;
}

function getPrevItem(key) {
  return get(getPrevKey(key));
}
