export type AuthResults ={
	scheme?: string;
	username?: string;
	password?: string;
}

export const basicAuthParser = (auth:string)=>{
	if(!auth){
		throw new Error(`Auth is null`);
	}
	const  result:AuthResults = {}
	const parts = auth.split(' ');
	result.scheme = parts[0];
	if(result.scheme!=='Basic'){
		return result;
	}
	const decoded =  Buffer.from(parts[1], 'base64').toString('utf-8');
	const colon = decoded.indexOf(':')
	result.username = decoded.substring(0, colon);
	result.password = decoded.substring(colon+1);
	return result
}
