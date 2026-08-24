import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import DemoApp from "@/components/DemoAppV6";
import {verifyStudentSession} from "@/lib/supabase-admin";

export default async function ProtectedStudentRoute({params}:{params:Promise<{path?:string[]}>}){
 const {path=[]}=await params;
 if(path.length&&path[0]!=="enter"){
  const store=await cookies();
  if(!verifyStudentSession(store.get("maeum_student_session")?.value||""))redirect("/student");
 }
 return <DemoApp/>;
}
