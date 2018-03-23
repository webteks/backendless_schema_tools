# Backendless App Comparison Tool (BACT)
###Purpose
The removal of "versions" in Backendless 4 menas that having dev/staging/live environments will require multiple apps. As a result, it is critical to be able to easily compare and sync schema and permissions. The purpose of this utility is to provide an easy mechanism to do just that.
#####Caution: SYNC warns and prompts before deletions or updates, but is destructive. Ensure you have backups before performing sync operations!

####How to install
 * To install and test from the repo simply run `npm install -g`
 * To install from npm simply run `npm install -g bact`

 _Compare, Monitor, and Sync schema and permissions of two or more Backendless Applications_
 
    usage: bact 

    -u, --username ['developer@company.com']                Required
    
    -p, --password ['developersPassowrd']                   Required
        
    -r, --reference ['live (Reference) ']                   Required: Reference Backendless Application
                                                            name or path to dump-file
                                                            
    -c, --compare ['dev (Comparison)']                      Required: Space seperated array of
                                                            application names or paths to compare ie:
                                                            dev alpha
                                                            
    -b, --backendless-url ['api.backendless.com']           Backendless URL Override
    
    -d, --dump [./path/file.json]                           Optional: Path to dump-file
    
    -t, --timeout [30000]                                   Default: 30000
    
    -v, --verbose                                           enables move verbose logging output
    
    -m, --monitor                                           enables monitor: return 0 if schemas are
                                                            identical, or 1 - if not or if there is an
                                                            error                                                            
    -s, --sync                                              Syncronize from control app into check app(s)
    
    -l, --check-list                                        Space separated list of check props: schema,
                                                            api, table_perms, role_perms, api_perms

Module for comparing applications details to a selected base.  Details to be compared; Schema tables table columns, column constraints, relationships, user and group permissions
