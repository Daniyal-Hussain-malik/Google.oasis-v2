import { Base, dt, enumCol, fk, int, text } from './_base.js';

export class Enquiry extends Base {}
Enquiry.setup(
  {
    topic: text({ len: 80, required: true }),
    name: text({ len: 120, required: true }),
    email: text({ len: 190, required: true, lower: true }),
    phone: text({ len: 30 }),
    message: text({ big: true, required: true, trim: false }),
    status: enumCol(['new', 'replied', 'closed'], 'new'),
    reply: text({ big: true, trim: false }),
    handledBy: fk('users'),
    replyDelivery_status: enumCol(['none', 'sent', 'failed'], 'none'),
    replyDelivery_attempts: int(0),
    replyDelivery_lastAttemptAt: dt(),
    replyDelivery_sentAt: dt(),
    replyDelivery_sentTo: text({ len: 190, allowNull: true }),
    replyDelivery_messageId: text({ len: 255, allowNull: true }),
    replyDelivery_failure: text({ len: 80, allowNull: true }),
    // Set while a reply is being sent, so two staff cannot send it twice.
    replyDelivery_lockedAt: dt(),
  },
  {
    table: 'enquiries',
    nested: { replyDelivery: ['status', 'attempts', 'lastAttemptAt', 'sentAt', 'sentTo', 'messageId', 'failure', 'lockedAt'] },
    indexes: [{ fields: ['topic'] }, { fields: ['status'] }, { fields: ['email'] }],
  },
);

export default Enquiry;
