import { IResolvers } from '@graphql-tools/utils';
import GMR from 'graphql-merge-resolvers';
//import cartoons from './cartoons';
import people from './people';
import user from './user';
import book from './book';

const resolver: any = GMR.merge({
    //cartoons,
    people,
    user,
    book

})



export default resolver;