import { DataTypes as D, Model } from 'sequelize';
import { currentTx, sequelize, tx } from '../config/db.js';

// One row per named sequence (booking numbers per year, order numbers per day...).
class Counter extends Model {}
Counter.init(
  { name: { type: D.STRING(80), primaryKey: true }, seq: { type: D.INTEGER, allowNull: false, defaultValue: 0 } },
  { sequelize, modelName: 'Counter', tableName: 'counters', timestamps: false },
);

// The number is taken inside one transaction that holds the row lock until commit,
// and calls in this process also queue, so two requests never get the same number.
let queue = Promise.resolve();
export function nextSequence(name, transaction) {
  const active = transaction || currentTx();
  if (active) return take(name, active);
  const run = queue.then(() => take(name));
  queue = run.catch(() => {});
  return run;
}

async function bump(name, transaction) {
  const [updated] = await Counter.update({ seq: sequelize.literal('seq + 1') }, { where: { name }, transaction });
  return updated;
}

async function take(name, transaction) {
  const work = async (t) => {
    if (!(await bump(name, t))) {
      try {
        await Counter.create({ name, seq: 1 }, { transaction: t });
        return 1;
      } catch (error) {
        if (error?.name !== 'SequelizeUniqueConstraintError') throw error;
        await bump(name, t);
      }
    }
    return (await Counter.findByPk(name, { transaction: t })).seq;
  };
  return transaction ? work(transaction) : tx(work);
}

export default Counter;
