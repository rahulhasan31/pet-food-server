const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express= require("express")
const cors= require("cors")
const app=express()
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.SRECRET_KEY);
const port=process.env.PORT||3000



//midware
app.use(express.json())
app.use(cors())
const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASSWORD
const is_live = false //true for live, false for sandbox

console.log(process.env.SRECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.sayatpw.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

function verifyJWT(req, res, next) {
  console.log("jwt pospo", req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(401).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}



async function run() {
  try {
    
  
const petFoodCategory=client.db("db-pet-food").collection("category")

const petCatFoods=client.db("db-pet-food").collection("catFoods")
const reviewsCollection=client.db("db-pet-food").collection("reviews")

const addToCartCollection=client.db("db-pet-food").collection('addToCart')
    
const PaymentCollection= client.db("db-pet-food").collection("payments")
const MyOrdersCollection= client.db("db-pet-food").collection("MyOders")
const usersCallection= client.db("db-pet-food").collection("users")


const verifyAdmin = async (req, res, next) => {
  console.log(req.decoded.email);
  const decodedEmail = req.decoded.email;
  const query = { email: decodedEmail };
  const user = await usersCallection.findOne(query);

  if (user?.role !== "admin") {
    return res.status(403).send({ message: "forbidden acess" });
  }

  next();
};

//admin.....
app.get('/api/v1/admin/:email', async(req, res)=>{
  const email= req.params.email
  console.log(email);
  const query={email:email}

  const user= await usersCallection.findOne(query)
  res.send({isAdmin:user.role==="admin"})
})
app.get('/api/v1/seller/:email', async(req, res)=>{
  const email= req.params.email
  console.log(email);
  const query={email:email}

  const user= await usersCallection.findOne(query)
  res.send({isSeller:user.role==="Seller"})
})



app.post("/create-payment-intent", async (req, res) => {
  const  {overallTotal}  = req.body;
  const amount = overallTotal ;
  
  const am= amount *100
  console.log( am);

  // Ensure that the amount is greater than or equal to the minimum allowed amount ($0.50 USD)

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).send({ error: "Internal Server Error" });
    }


});




app.post('/payments', async(req, res)=>{
    const payment=req.body
    console.log(payment);

    const mapData= payment.foods.map(food=>({...food , _id: new ObjectId(),email:payment.email, transactionId:payment.transactionId, overallTotal:payment.overallTotal}))
    console.log(mapData);
    const result= await PaymentCollection.insertMany(mapData)
    const email=payment.email
    const filter={userEmail:email}
    const updatedDuc={
      $set:{
        paid:true,
        transactionId:payment.transactionId
      }
    }
    const updatereult= await addToCartCollection.updateMany(filter,updatedDuc)
    res.send(result)
})



app.get('/my-payments', async(req, res)=>{
  const email = req.query.email
  const quary= {email:email}
  const result= await PaymentCollection.find(quary).toArray()
  res.send(result)
})
app.get('/my-order', async(req, res)=>{
    const email=req.query.email
   
    const quary={userEmail:email}
    const result= await MyOrdersCollection.find(quary).toArray()
    res.send(result)
})
    
 app.post('/api/v1/category', async(req, res)=>{
      
    const petCategory= req.body
     console.log(petCategory);
    const query={
        category:petCategory.category
    }

    const result= await petFoodCategory.insertOne(query)

    res.send({
        status:true,
        message:"category Insert Succesfully",
        data:result
    })


 })


  app.get("/api/v1/catgory", async(req, res)=>{
     const query= {}
     const result= await petFoodCategory.find(query).toArray()
     res.send({
        status:true,
        message:"Category Get Succesfully",
        data:result
    })
  })
  
 
  
  

  app.get('/api/v1/cat-food', async(req, res)=>{
       const query={}
       const result=await petCatFoods.find(query).toArray()
       res.send(result)
    
  })

  app.get('/api/v1/cat-foods', async (req, res) => {
  try {
    const search = req.query.search;

    const query = {
      $or: [
        { name: { $regex: search, $options: 'i' } }, // Case-insensitive search
        
      ],
    };

    const result = await petCatFoods.find(query).toArray();

    res.send({
      status: true,
      message: 'Products retrieved successfully',
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      status: false,
      message: 'Internal server error',
    });
  }
});

app.post('/api/v1/add/cat-food-add', async(req, res)=>{
  const food= req.body
  console.log(food);
  const query={
   name: food.name,
   price:food.price,
   imageURL: food.imageURL,
   quantity: food.quantity,
   description:food.description ,
   userEmail: food.userEmail,
   shop: food.shop
     
  }
  const result= await petCatFoods.insertOne(query)

 res.send({
     status:true,
     message:"products Insert Succesfully",
     data:result
 })
})
  app.get('/api/v1/cat-foods-query', async (req, res) => {
  try {
    const shop = req.query.shop;

    const query = {
      $or: [
        { shop: { $regex: new RegExp(shop), $options: '' } }, // Case-insensitive search
        
      ],
    };

    const result = await petCatFoods.find(query).toArray();

    res.send({
      status: true,
      message: 'Products retrieved successfully',
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      status: false,
      message: 'Internal server error',
    });
  }
});

  

  app.get('/api/v1/cat-foods/:id', async (req, res) => {
    const id = req.params.id;

    // Check if the provided ID is a valid ObjectId
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
    }

    try {
        const query = { _id: new ObjectId(id) };
        const result = await petCatFoods.findOne(query);

        // Check if the cat food with the given ID exists
        if (!result) {
            return res.status(404).json({ error: 'Cat food not found' });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching cat food:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/v1/review/:id', async(req, res)=>{
  const id=req.params.id
  console.log(id);
  const query={_id:new ObjectId(id)}
  const result= await reviewsCollection.findOne(query)
  res.send(result)
})
app.get('/api/v1/reviews', async(req, res)=>{

  const query={}
  const result= await reviewsCollection.find(query).toArray()
  res.send(result)
})



app.post('/api/v1/reviews', async(req, res)=>{
  const reviews=req.body
  console.log(reviews);
  const result = await reviewsCollection.insertOne(reviews)
  res.send(result)
})




app.get('/api/v1/reviews/:id', async(req, res)=>{
 
  const id=req.params.id
  console.log(id);
  const query={foodID:id}
  const cousor = reviewsCollection.find(query)
  const result = await cousor.toArray()
  res.send(result)
})

app.patch('/api/v1/reviews/:id', async(req, res)=>{
  const id=req.params.id
  console.log(id)
  const query={_id: new ObjectId(id)}
  const options={upsert: true}
  const review=req.body
  console.log(review)
  const updateReview={
    $set:{
      review:review.review
    }
  }
  const result= await reviewsCollection.updateOne(query,updateReview,options)
  res.send(result)
})

app.delete('/api/v1/reviews/:id', async(req, res)=>{
  const id=req.params.id
  const query={_id:new ObjectId(id)}
  const result= await reviewsCollection.deleteOne(query)
  res.send(result)
})



app.get('/api/v1/reviews-quary',verifyJWT, async(req, res)=>{

  const email=req.query.email
 console.log("reviewEmail", email);
 const decodedEmail=req.decoded.email
 
//  const emailDecoded=req.decoded.email
console.log('emailDecoded', decodedEmail);
if(email !== decodedEmail){
  return res.status(403).send({message:"forbidden access"})
}

const quary={userEmail:email}
  
 const  result = await reviewsCollection.find(quary).toArray()
 res.send(result)
})



app.post('/api/v1/add-to-cart', async (req, res) => {
  try {
    const foods = req.body;
    console.log(foods._id);

    // Check if the item already exists in the cart based on userEmail and food _id
    const existingItem = await addToCartCollection.findOne({
      foodId: foods._id,
      userEmail: foods.userEmail
    });

    if (existingItem) {
      // If it exists for the specific user, update the quantity
      const result = await addToCartCollection.updateOne(
        { _id: existingItem._id },
        { $inc: { quantity: 1 } }
      );

      console.log('update result', result);
      res.send(result);
    } else {
      // If it doesn't exist, create a new entry with a specified _id and quantity 1
      const newItem = {
        foodId: foods._id,
        name: foods.name,
        price: foods.price,
        imageURL: foods.imageURL,
        quantity: 1,
        description: foods.description,
        subCategory: foods.subCategory,
        userEmail: foods.userEmail
        // other fields...
      };

      const result = await addToCartCollection.insertOne(newItem);
      console.log('insert result', result);
      res.status(201).send(newItem);
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).send({ error: 'Internal server error.', details: error.message });
  }
});

app.post('/api/v1/decrement-cart-item', async (req, res) => {
  try {
    const foods = req.body;

    // Check if the item exists in the cart based on userEmail and food _id
    const existingItem = await addToCartCollection.findOne({
      foodId: foods._id,
      userEmail: foods.userEmail
    });

    if (existingItem) {
      // If the quantity is greater than 1, decrement the quantity
      if (existingItem.quantity > 1) {
        const result = await addToCartCollection.updateOne(
          { _id: existingItem._id },
          { $inc: { quantity: -1 } }
        );

        console.log('decrement result', result);
        res.send(result);
      } else {
        // If the quantity is 1, remove the item from the cart
        const result = await addToCartCollection.deleteOne({ _id: existingItem._id });
        console.log('delete result', result);
        res.send(result);
      }
    } else {
      // If the item is not found, respond accordingly
      res.status(404).send({ error: 'Item not found in the cart.' });
    }
  } catch (error) {
    console.error('Error decrementing cart item:', error);
    res.status(500).send({ error: 'Internal server error.', details: error.message });
  }
});

app.delete('/api/v1/add-to-cart/:id', async(req, res)=>{
  const  id=req.params.id
  const quary={_id:new ObjectId(id)}
  const result= await addToCartCollection.deleteOne(quary)
  res.send(result)
})

 app.get('/api/v1/add-to-cart', async(req, res)=>{

     const quary={}
   const result= await addToCartCollection.find(quary).toArray()
     res.send(result)
 })


 app.get('/api/v1/add-to-cart/quary', verifyJWT, async(req, res)=>{
   const email=req.query.email
   const decodeEmail=req.decoded.email
   if(email !== decodeEmail){
    return res.status(403).send({message:"forbiden access"})
   }
   const quary={userEmail:email}
   const result= await addToCartCollection.find(quary).toArray()
   res.send(result)

 })


 app.post('/api/v1/users', async(req, res)=>{
   const users=req.body
   const result= await usersCallection.insertOne(users)
   res.send(result)
 })


// seller add products,

app.get('/api/seller/foods', async(req, res)=>{
  const email=req.query.email
  const query={userEmail:email}
  const result= await petCatFoods.find(query).toArray()
  res.send(result)
})

app.delete('/api/seller-food/delete/:id', async(req, res)=>{
    const id=req.params.id
    const quary={_id:new ObjectId(id)}
    const result=await petCatFoods.deleteOne(quary)
    res.send(result)
})

//  jwt

app.get('/jwt', async(req, res)=>{
   const email= req.query.email
   const query={email:email}
   const user= await usersCallection.findOne(query)
    console.log("user", user);
   if (user) {
     const token= jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn:'1h'})
     return res.send({accessToken:token})
   }
   console.log(user);
   res.status(403).send({accessToken:""})
})


//  users

app.get('/api/user/query', verifyJWT,  async(req, res)=>{
  const email=req.query.email
  const query={email:email}
  const result= await usersCallection.findOne(query)
  res.send(result)
})

app.patch('/api/user-update', verifyJWT, async(req, res)=>{
  const email =req.query.email
  const query={email:email}
  const option={upsert:true}
  const user=req.body
  console.log(user);
if (user.role=="Seller") {
  const updatedDuc={
    $set:{
     
      name: user.name,
      email: user.email,
      role: user.role,
      imageURL:user.imageURL,
      number:user.number,
      shop:user.shop,
      shopAddress:user.shopAddress
    }

}
const result = await usersCallection.updateOne(query,updatedDuc, option )

console.log("if",result);
res.send(result)
}
else{
  const updatedDuc={
    $set:{
     
      name: user.name,
      email: user.email,
      role: user.role,
      imageURL:user.imageURL,
      number:user.number,
      Address:user.Address
    }


}

const result = await usersCallection.updateOne(query,updatedDuc, option )

console.log("e",result);
res.send(result)
}
 
  
})

app.get('/api/seller', async(req, res)=>{
  const query={role:"Seller"}
  const result= await usersCallection.find(query).toArray()
  res.send(result)
})

app.delete('/api/seller/delete/:id', async(req, res)=>{
        const id=req.params.id
        console.log(id);
        const query={_id:new ObjectId(id)}
        const result= await usersCallection.deleteOne(query)
        res.send(result)

})

app.get('/api/all-user',verifyJWT,verifyAdmin, async(req, res)=>{
  const query={role:"User"}
  const result=await usersCallection.find(query).toArray()
  res.send(result)
} )



app.get('/api/all-payment',verifyJWT, verifyAdmin, async(req, res)=>{
  const query={}
  const result= await PaymentCollection.find(query).toArray()
  res.send(result)
})


app.put('/api/order-confirm/:transactionId',verifyJWT, verifyAdmin, async(req, res)=>{
  const transactionId = req.params.transactionId
  
  const filter={transactionId:transactionId}
  console.log(filter);
  const option={upsert:true}
  const update={
    $set:{
      status:"Order Confirm"
    }
  }
  const result= await PaymentCollection.updateMany(filter, update, option)
  console.log(result);
  res.send(result)
})













    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  
  } finally {
   
    
  }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });