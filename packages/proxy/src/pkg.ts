import { join } from 'path';
import { readFileSync } from 'fs';

export default JSON.parse(
	readFileSync(join(__dirname, '../package.json'), 'utf8')
);