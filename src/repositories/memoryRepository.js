// In-memory storage. Swap this for a database-backed class with the same
// three methods (findById, findAll, save) to add persistence.
class MemoryRepository {
  constructor() {
    this.devices = new Map();
  }
  findById(id) {
    return this.devices.get(id) || null;
  }
  findAll() {
    return [...this.devices.values()];
  }
  save(device) {
    this.devices.set(device.id, device);
    return device;
  }
}
module.exports = MemoryRepository;
