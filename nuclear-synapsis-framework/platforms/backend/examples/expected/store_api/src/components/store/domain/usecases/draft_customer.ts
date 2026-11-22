import { NewCustomer } from '../models/new_customer.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** A customer not saved yet, built in code from what the client said: the model's rules are checked when it is built. */
@Injectable()
export class DraftCustomer {
  exec(email: string): Result<AppError, NewCustomer> {
    return Ok(new NewCustomer({ email: email, name: 'draft' }));
  }
}
