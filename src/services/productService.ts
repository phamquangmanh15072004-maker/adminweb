import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc } from "firebase/firestore";

export const subscribeProducts = (onData: (data: any[]) => void) => {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    onData(products);
  });
};

export const updateProductStatus = async (id: string, status: boolean) => {
  const productRef = doc(db, "products", id);
  return await updateDoc(productRef, { isActive: status });
};
export const addProduct = async (productData: any) => {
  const collectionRef = collection(db, "products");
  const newDoc = {
    ...productData,
    id: productData?.id || productData?.sku || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const docRef = await addDoc(collectionRef, newDoc);
  await updateDoc(docRef, { id: docRef.id });
  return docRef;
};
export const updateProduct = async (id: string, productData: any) => {
  const productRef = doc(db, "products", id);
  return await updateDoc(productRef, {
    ...productData,
    updatedAt: Date.now(),
  });
};